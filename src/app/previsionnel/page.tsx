import { Suspense } from "react";
import { db } from "@/db";
import {
  affectations,
  missions,
  clients,
  freelances,
  projets,
  encaissements,
  decaissements,
} from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatMois } from "@/lib/format";
import { premierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { fractionFiabilite } from "@/lib/calculs/previsionnel";
import { PERIODES } from "@/app/statistiques/stats-config";
import { StatsFiltres } from "@/app/statistiques/stats-filtres";
import { StatsFiltreDrawer } from "@/app/statistiques/stats-filtre-drawer";
import { exigerSession } from "@/lib/auth/server";

const arrondi = (n: number) => Math.round(n * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// Fenêtre prévisionnelle (vers l'avenir) : du début du mois courant jusqu'à
// aujourd'hui + N jours, ou plage personnalisée.
function fenetre(periode: string, debutPerso: string, finPerso: string, annee: number, mois: number) {
  if (periode === "perso") return { debut: debutPerso, fin: finPerso };
  const n = Number(periode) || 365;
  const fin = new Date();
  fin.setUTCDate(fin.getUTCDate() + n);
  return { debut: premierJourDuMois(annee, mois), fin: isoJour(fin) };
}

export default async function PagePrevisionnel({
  searchParams,
}: {
  searchParams: Promise<{
    periode?: string;
    debut?: string;
    fin?: string;
    freelances?: string;
    clients?: string;
    missions?: string;
  }>;
}) {
  await exigerSession();

  const params = await searchParams;
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  const aujourd = isoJour(maintenant);

  const periode = PERIODES.some((p) => p.key === params.periode) ? params.periode! : "365";
  const debutPerso = params.debut || aujourd;
  const finPerso = params.fin || aujourd;
  const { debut, fin } = fenetre(periode, debutPerso, finPerso, annee, mois);

  // Filtres (ids séparés par des virgules).
  const ids = (v?: string) =>
    (v ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const selFreelances = ids(params.freelances);
  const selClients = ids(params.clients);
  const selMissions = ids(params.missions);

  // --- Régie (missions) : marge planifiée des jours posés ---
  const condRegie = [gte(affectations.date, debut), lte(affectations.date, fin)];
  if (selFreelances.length) condRegie.push(inArray(affectations.freelanceId, selFreelances));
  if (selClients.length) condRegie.push(inArray(missions.clientId, selClients));
  if (selMissions.length) condRegie.push(inArray(affectations.missionId, selMissions));
  const affs = await db
    .select({ date: affectations.date, tjmAchat: affectations.tjmAchat, tjmVente: affectations.tjmVente })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .where(and(...condRegie));

  // --- Forfait : un projet n'est pas une mission, on l'exclut si filtre missions ---
  const forfaitActif = selMissions.length === 0;
  let encs: { date: string; montant: string; statut: string; fiabilite: string | null }[] = [];
  let decs: { date: string; montant: string }[] = [];
  if (forfaitActif) {
    const condEnc = [gte(encaissements.date, debut), lte(encaissements.date, fin)];
    if (selClients.length) condEnc.push(inArray(projets.clientId, selClients));
    // Les encaissements n'ont pas de freelance : exclus si un filtre freelance est posé.
    if (selFreelances.length === 0) {
      encs = await db
        .select({
          date: encaissements.date,
          montant: encaissements.montant,
          statut: encaissements.statut,
          fiabilite: encaissements.fiabilite,
        })
        .from(encaissements)
        .innerJoin(projets, eq(encaissements.projetId, projets.id))
        .where(and(...condEnc));
    }
    const condDec = [gte(decaissements.date, debut), lte(decaissements.date, fin)];
    if (selClients.length) condDec.push(inArray(projets.clientId, selClients));
    if (selFreelances.length) condDec.push(inArray(decaissements.freelanceId, selFreelances));
    decs = await db
      .select({ date: decaissements.date, montant: decaissements.montant })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .where(and(...condDec));
  }

  // Agrégation par mois.
  type M = { caMax: number; caProb: number; charges: number };
  const parMois = new Map<string, M>();
  const get = (cle: string) => {
    const m = parMois.get(cle) ?? { caMax: 0, caProb: 0, charges: 0 };
    parMois.set(cle, m);
    return m;
  };
  for (const a of affs) {
    const m = get(a.date.slice(0, 7));
    m.caMax += Number(a.tjmVente);
    m.caProb += Number(a.tjmVente); // la régie planifiée est certaine
    m.charges += Number(a.tjmAchat);
  }
  for (const e of encs) {
    const m = get(e.date.slice(0, 7));
    if (e.statut === "prevu") {
      const proba = fractionFiabilite(e.fiabilite);
      m.caMax += Number(e.montant);
      m.caProb += Number(e.montant) * proba;
    } else {
      m.caMax += Number(e.montant);
      m.caProb += Number(e.montant);
    }
  }
  for (const d of decs) {
    const m = get(d.date.slice(0, 7));
    m.charges += Number(d.montant); // les coûts comptent à 100 %
  }

  // Bornage : du mois courant jusqu'au dernier mois ayant des données.
  const moisAvecData = [...parMois.keys()].sort();
  const debutCle = `${annee}-${pad2(mois)}`;
  const dernier = moisAvecData[moisAvecData.length - 1];

  const lignes: {
    cle: string;
    a: number;
    m: number;
    caMax: number;
    caProb: number;
    charges: number;
    margeMax: number;
    margeProb: number;
    cumulMax: number;
    cumulProb: number;
  }[] = [];

  if (dernier && dernier >= debutCle) {
    let cumulMax = 0;
    let cumulProb = 0;
    let [a, m] = debutCle.split("-").map(Number);
    while (`${a}-${pad2(m)}` <= dernier) {
      const cle = `${a}-${pad2(m)}`;
      const data = parMois.get(cle) ?? { caMax: 0, caProb: 0, charges: 0 };
      const margeMax = data.caMax - data.charges;
      const margeProb = data.caProb - data.charges;
      cumulMax += margeMax;
      cumulProb += margeProb;
      lignes.push({
        cle,
        a,
        m,
        caMax: arrondi(data.caMax),
        caProb: arrondi(data.caProb),
        charges: arrondi(data.charges),
        margeMax: arrondi(margeMax),
        margeProb: arrondi(margeProb),
        cumulMax: arrondi(cumulMax),
        cumulProb: arrondi(cumulProb),
      });
      if (m === 12) {
        a += 1;
        m = 1;
      } else m += 1;
    }
  }

  const totalMargeMax = lignes.length ? lignes[lignes.length - 1].cumulMax : 0;
  const totalMargeProb = lignes.length ? lignes[lignes.length - 1].cumulProb : 0;

  // Options des filtres (mêmes que les statistiques).
  const [optFreelances, optClients, optMissions] = await Promise.all([
    db
      .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom })
      .from(freelances)
      .orderBy(freelances.nom),
    db.select({ id: clients.id, nom: clients.nom }).from(clients).orderBy(clients.nom),
    db
      .select({ id: missions.id, nom: missions.nom, clientNom: clients.nom })
      .from(missions)
      .innerJoin(clients, eq(missions.clientId, clients.id))
      .orderBy(missions.nom),
  ]);

  return (
    <div className="space-y-6">
      <Suspense>
        <StatsFiltres
          periode={periode}
          grouper="mois"
          debut={debutPerso}
          fin={finPerso}
          showGrouper={false}
        >
          <StatsFiltreDrawer
            clients={optClients.map((c) => ({ value: String(c.id), label: c.nom }))}
            freelances={optFreelances.map((f) => ({
              value: String(f.id),
              label: `${f.prenom} ${f.nom}`,
            }))}
            missions={optMissions.map((m) => ({
              value: String(m.id),
              label: `${m.nom} (${m.clientNom})`,
            }))}
            selClients={selClients.map(String)}
            selFreelances={selFreelances.map(String)}
            selMissions={selMissions.map(String)}
          />
        </StatsFiltres>
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2">
        <Indicateur titre="Marge maximum (cumulée)" valeur={formatEuro(totalMargeMax)} />
        <Indicateur titre="Marge probable (cumulée)" valeur={formatEuro(totalMargeProb)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prévisionnel mois par mois</CardTitle>
        </CardHeader>
        <CardContent>
          {lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée prévisionnelle sur cette période. Posez des jours dans le planning ou
              ajoutez des échéances aux projets.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">CA max</TableHead>
                    <TableHead className="text-right">CA probable</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead className="text-right">Marge max</TableHead>
                    <TableHead className="text-right">Marge probable</TableHead>
                    <TableHead className="text-right">Marge cumulée max</TableHead>
                    <TableHead className="text-right">Marge cumulée probable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l) => (
                    <TableRow key={l.cle}>
                      <TableCell className="font-medium capitalize">{formatMois(l.a, l.m)}</TableCell>
                      <TableCell className="text-right">{formatEuro(l.caMax)}</TableCell>
                      <TableCell className="text-right">{formatEuro(l.caProb)}</TableCell>
                      <TableCell className="text-right text-rose-600">{formatEuro(l.charges)}</TableCell>
                      <TableCell className={`text-right ${l.margeMax < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.margeMax)}
                      </TableCell>
                      <TableCell className={`text-right ${l.margeProb < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.margeProb)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${l.cumulMax < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.cumulMax)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${l.cumulProb < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.cumulProb)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Indicateur({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal text-muted-foreground">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
