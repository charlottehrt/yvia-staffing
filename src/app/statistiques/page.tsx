import { Suspense } from "react";
import { db } from "@/db";
import { affectations, missions, clients, freelances } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { formatEuro, formatPourcent, formatJours, formatMois } from "@/lib/format";
import { StatsFiltres } from "./stats-filtres";
import { PERIODES, GROUPES } from "./stats-config";
import { StatsTable, type LigneStat } from "./stats-table";

const arrondi = (n: number) => Math.round(n * 100) / 100;

// Bornes [debut, fin] (texte "AAAA-MM-JJ") selon la période choisie.
function bornesPeriode(
  periode: string,
  debutMois: string,
  finMois: string,
  annee: number,
  mois: number
): { debut: string; fin: string } {
  switch (periode) {
    case "mois":
      return { debut: premierJourDuMois(annee, mois), fin: dernierJourDuMois(annee, mois) };
    case "trimestre": {
      const q = Math.floor((mois - 1) / 3);
      return {
        debut: premierJourDuMois(annee, q * 3 + 1),
        fin: dernierJourDuMois(annee, q * 3 + 3),
      };
    }
    case "12mois": {
      const total = mois + 11;
      const aFin = annee + Math.floor((total - 1) / 12);
      const mFin = ((total - 1) % 12) + 1;
      return { debut: premierJourDuMois(annee, mois), fin: dernierJourDuMois(aFin, mFin) };
    }
    case "debut":
      return { debut: "2026-06-01", fin: "2999-12-31" };
    case "perso": {
      const [da, dm] = debutMois.split("-").map(Number);
      const [fa, fm] = finMois.split("-").map(Number);
      return { debut: premierJourDuMois(da, dm), fin: dernierJourDuMois(fa, fm) };
    }
    case "annee":
    default:
      return { debut: `${annee}-01-01`, fin: `${annee}-12-31` };
  }
}

export default async function PageStatistiques({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; grouper?: string; debut?: string; fin?: string }>;
}) {
  const params = await searchParams;
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;

  const periode = PERIODES.some((p) => p.key === params.periode) ? params.periode! : "annee";
  const grouper = GROUPES.some((g) => g.key === params.grouper) ? params.grouper! : "mois";
  const debutMois = params.debut || `${annee}-01`;
  const finMois = params.fin || `${annee}-12`;

  const { debut, fin } = bornesPeriode(periode, debutMois, finMois, annee, mois);

  // Tous les jours posés de la période, avec leurs dimensions.
  const rows = await db
    .select({
      date: affectations.date,
      tjmAchat: affectations.tjmAchat,
      tjmVente: affectations.tjmVente,
      freelanceId: affectations.freelanceId,
      freelancePrenom: freelances.prenom,
      freelanceNom: freelances.nom,
      missionId: affectations.missionId,
      missionNom: missions.nom,
      clientId: missions.clientId,
      clientNom: clients.nom,
    })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .innerJoin(freelances, eq(affectations.freelanceId, freelances.id))
    .where(and(gte(affectations.date, debut), lte(affectations.date, fin)));

  // Indicateurs globaux de la période.
  const caTotal = arrondi(rows.reduce((s, r) => s + Number(r.tjmVente), 0));
  const coutTotal = arrondi(rows.reduce((s, r) => s + Number(r.tjmAchat), 0));
  const margeTotale = arrondi(caTotal - coutTotal);
  const tauxMarge = caTotal > 0 ? margeTotale / caTotal : 0;
  const joursTotal = rows.length;
  const margeJour = joursTotal > 0 ? arrondi(margeTotale / joursTotal) : 0;

  // Agrégation par dimension choisie.
  type Acc = { cle: string; label: string; ordreLabel: string; ca: number; cout: number; jours: number };
  const map = new Map<string, Acc>();
  for (const r of rows) {
    let cle: string;
    let label: string;
    let ordreLabel: string;
    if (grouper === "freelance") {
      cle = `f${r.freelanceId}`;
      label = `${r.freelancePrenom} ${r.freelanceNom}`;
      ordreLabel = label.toLowerCase();
    } else if (grouper === "client") {
      cle = `c${r.clientId}`;
      label = r.clientNom;
      ordreLabel = label.toLowerCase();
    } else if (grouper === "mission") {
      cle = `m${r.missionId}`;
      label = r.missionNom;
      ordreLabel = label.toLowerCase();
    } else {
      cle = r.date.slice(0, 7); // "AAAA-MM"
      label = formatMois(Number(cle.slice(0, 4)), Number(cle.slice(5, 7)));
      ordreLabel = cle;
    }
    const g = map.get(cle) ?? { cle, label, ordreLabel, ca: 0, cout: 0, jours: 0 };
    g.ca += Number(r.tjmVente);
    g.cout += Number(r.tjmAchat);
    g.jours += 1;
    map.set(cle, g);
  }

  const lignes: LigneStat[] = Array.from(map.values()).map((g) => ({
    cle: g.cle,
    label: g.label,
    ordreLabel: g.ordreLabel,
    ca: arrondi(g.ca),
    cout: arrondi(g.cout),
    marge: arrondi(g.ca - g.cout),
    taux: g.ca > 0 ? (g.ca - g.cout) / g.ca : 0,
    jours: g.jours,
  }));

  // Ordre par défaut : chronologique pour les mois, sinon marge décroissante.
  if (grouper === "mois") lignes.sort((a, b) => (a.ordreLabel < b.ordreLabel ? -1 : 1));
  else lignes.sort((a, b) => b.marge - a.marge);

  const labelColonne = GROUPES.find((g) => g.key === grouper)!.label;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Statistiques</h1>

      <Card>
        <CardContent className="pt-6">
          <Suspense>
            <StatsFiltres periode={periode} grouper={grouper} debut={debutMois} fin={finMois} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Indicateurs de la période */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Indicateur titre="CA" valeur={formatEuro(caTotal)} />
        <Indicateur titre="Coût" valeur={formatEuro(coutTotal)} />
        <Indicateur titre="Marge" valeur={formatEuro(margeTotale)} />
        <Indicateur titre="Taux de marge" valeur={formatPourcent(tauxMarge)} />
        <Indicateur titre="Jours facturés" valeur={formatJours(joursTotal)} />
        <Indicateur titre="Marge / jour" valeur={formatEuro(margeJour)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détail par {labelColonne.toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent>
          {lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée sur cette période. Ajustez les filtres ou remplissez le planning.
            </p>
          ) : (
            <StatsTable lignes={lignes} labelColonne={labelColonne} />
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
