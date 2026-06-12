import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import {
  missions,
  freelances,
  clients,
  affectations,
  projets,
  encaissements,
  decaissements,
  jalons,
} from "@/db/schema";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estJourFerie } from "@/lib/calculs/jours-feries";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { formatEuro, formatPourcent, formatJours, formatMois } from "@/lib/format";
import { PlanningCalendar, type Couleur, type LigneFreelance, type Jour } from "./planning-calendar";
import { EtendreMoisButton } from "./etendre-mois-button";
import { EntityLink } from "./_drawer/drawer-stack";
import { exigerSession } from "@/lib/auth/server";

const pad2 = (n: number) => String(n).padStart(2, "0");
const moisSuivant = (a: number, m: number) =>
  m === 12 ? { annee: a + 1, mois: 1 } : { annee: a, mois: m + 1 };
const moisPrecedent = (a: number, m: number) =>
  m === 1 ? { annee: a - 1, mois: 12 } : { annee: a, mois: m - 1 };

// Palette pour distinguer les missions dans le planning.
// Tons désaturés et cohérents avec la DA Yvia (dominante froide), assez
// différents les uns des autres pour ne pas confondre deux missions voisines.
const PALETTE: Couleur[] = [
  { bg: "#0571ed", fg: "#ffffff" }, // bleu Yvia
  { bg: "#0b172b", fg: "#ffffff" }, // navy
  { bg: "#2e8b8b", fg: "#ffffff" }, // sarcelle
  { bg: "#52698f", fg: "#ffffff" }, // ardoise
  { bg: "#5b6fb0", fg: "#ffffff" }, // bleu-violet
  { bg: "#5a8f6b", fg: "#ffffff" }, // vert-de-gris
  { bg: "#7a5f99", fg: "#ffffff" }, // prune doux
  { bg: "#b07d3c", fg: "#ffffff" }, // ocre doux
];

const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];

export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; mois?: string }>;
}) {
  await exigerSession();

  const params = await searchParams;
  const maintenant = new Date();
  const annee = Number(params.annee) || maintenant.getUTCFullYear();
  const moisParam = Number(params.mois);
  const mois = moisParam >= 1 && moisParam <= 12 ? moisParam : maintenant.getUTCMonth() + 1;

  const suivant = moisSuivant(annee, mois);
  const precedent = moisPrecedent(annee, mois);
  const debutMois = premierJourDuMois(annee, mois);
  const finMois = dernierJourDuMois(annee, mois);

  // Jours du mois (avec week-ends, jours fériés, et repérage d'aujourd'hui).
  const aujourdhuiISO = maintenant.toISOString().slice(0, 10);
  const nbJours = Number(finMois.slice(8, 10));
  const jours: Jour[] = [];
  for (let d = 1; d <= nbJours; d++) {
    const date = `${annee}-${pad2(mois)}-${pad2(d)}`;
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    jours.push({
      date,
      num: d,
      lettre: LETTRES[dow],
      weekend: dow === 0 || dow === 6,
      ferie: estJourFerie(date),
      estAujourdhui: date === aujourdhuiISO,
    });
  }

  // Données.
  const [
    freelancesActifs,
    clientsActifs,
    missionsDispo,
    affs,
    projetsActifs,
    encMois,
    decMois,
    jalMois,
  ] = await Promise.all([
    db
      .select({
        id: freelances.id,
        prenom: freelances.prenom,
        nom: freelances.nom,
        afficherPlanning: freelances.afficherPlanning,
      })
      .from(freelances)
      .where(eq(freelances.actif, true))
      .orderBy(freelances.nom),
    db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.actif, true))
      .orderBy(clients.nom),
    db
      .select({
        id: missions.id,
        nom: missions.nom,
        freelanceId: missions.freelanceId,
        clientNom: clients.nom,
      })
      .from(missions)
      .innerJoin(clients, eq(missions.clientId, clients.id))
      .where(eq(missions.actif, true)),
    db
      .select({
        freelanceId: affectations.freelanceId,
        date: affectations.date,
        missionId: affectations.missionId,
        missionNom: missions.nom,
        tjmAchat: affectations.tjmAchat,
        tjmVente: affectations.tjmVente,
        clientNom: clients.nom,
        prenom: freelances.prenom,
        nom: freelances.nom,
      })
      .from(affectations)
      .innerJoin(missions, eq(affectations.missionId, missions.id))
      .innerJoin(clients, eq(missions.clientId, clients.id))
      .innerJoin(freelances, eq(affectations.freelanceId, freelances.id))
      .where(and(gte(affectations.date, debutMois), lte(affectations.date, finMois))),
    db
      .select({ id: projets.id, nom: projets.nom, clientNom: clients.nom, budget: projets.budget })
      .from(projets)
      .innerJoin(clients, eq(projets.clientId, clients.id))
      .where(and(eq(projets.actif, true), ne(projets.statutCommercial, "perdu")))
      .orderBy(projets.nom),
    db
      .select({
        id: encaissements.id,
        projetId: encaissements.projetId,
        date: encaissements.date,
        montant: encaissements.montant,
        libelle: encaissements.libelle,
      })
      .from(encaissements)
      .innerJoin(projets, eq(encaissements.projetId, projets.id))
      .where(
        and(
          eq(encaissements.statut, "encaisse"), // réalisé uniquement (le prévu ne compte pas comme CA)
          eq(projets.actif, true),
          ne(projets.statutCommercial, "perdu"),
          gte(encaissements.date, debutMois),
          lte(encaissements.date, finMois)
        )
      ),
    db
      .select({
        id: decaissements.id,
        projetId: decaissements.projetId,
        date: decaissements.date,
        montant: decaissements.montant,
        libelle: decaissements.libelle,
        prenom: freelances.prenom,
        nom: freelances.nom,
      })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id))
      .where(
        and(
          eq(decaissements.statut, "decaisse"), // coût réalisé uniquement
          eq(projets.actif, true),
          ne(projets.statutCommercial, "perdu"),
          gte(decaissements.date, debutMois),
          lte(decaissements.date, finMois)
        )
      ),
    db
      .select({
        id: jalons.id,
        projetId: jalons.projetId,
        date: jalons.date,
        libelle: jalons.libelle,
      })
      .from(jalons)
      .innerJoin(projets, eq(jalons.projetId, projets.id))
      .where(
        and(
          eq(projets.actif, true),
          ne(projets.statutCommercial, "perdu"),
          gte(jalons.date, debutMois),
          lte(jalons.date, finMois)
        )
      ),
  ]);

  // Événements regroupés par projet puis par date.
  type EvenementProjet = {
    id: number;
    type: "encaissement" | "decaissement" | "jalon";
    montant: string | null; // null pour un jalon (pas de montant)
    libelle: string | null;
    freelanceNom: string | null;
  };
  const evenementsParProjet = new Map<number, Record<string, EvenementProjet[]>>();
  const ajouterEvenement = (
    projetId: number,
    date: string,
    ev: EvenementProjet
  ) => {
    const parDate = evenementsParProjet.get(projetId) ?? {};
    parDate[date] = [...(parDate[date] ?? []), ev];
    evenementsParProjet.set(projetId, parDate);
  };
  for (const e of encMois)
    ajouterEvenement(e.projetId, e.date, {
      id: e.id,
      type: "encaissement",
      montant: e.montant,
      libelle: e.libelle,
      freelanceNom: null,
    });
  for (const d of decMois)
    ajouterEvenement(d.projetId, d.date, {
      id: d.id,
      type: "decaissement",
      montant: d.montant,
      libelle: d.libelle,
      freelanceNom: `${d.prenom} ${d.nom}`,
    });
  for (const j of jalMois)
    ajouterEvenement(j.projetId, j.date, {
      id: j.id,
      type: "jalon",
      montant: null,
      libelle: j.libelle,
      freelanceNom: null,
    });

  const projetsLignes = projetsActifs.map((p) => ({
    id: p.id,
    nom: p.nom,
    clientNom: p.clientNom,
    budget: p.budget,
    evenements: evenementsParProjet.get(p.id) ?? {},
  }));

  // CA / coût du mois apportés par les forfaits (événements datés ce mois).
  const caForfait = encMois.reduce((s, e) => s + Number(e.montant), 0);
  const coutForfait = decMois.reduce((s, d) => s + Number(d.montant), 0);

  // Couleur stable par mission.
  const idsMissions = Array.from(
    new Set([...missionsDispo.map((m) => m.id), ...affs.map((a) => a.missionId)])
  ).sort((a, b) => a - b);
  const couleurDe = (missionId: number): Couleur =>
    PALETTE[idsMissions.indexOf(missionId) % PALETTE.length];

  // Légende : pour chaque mission affichée dans la grille, sa couleur, son nom et son client.
  const infosMission = new Map<number, { nom: string; clientNom: string }>();
  for (const m of missionsDispo) infosMission.set(m.id, { nom: m.nom, clientNom: m.clientNom });
  for (const a of affs)
    if (!infosMission.has(a.missionId))
      infosMission.set(a.missionId, { nom: a.missionNom, clientNom: a.clientNom });
  const legende = idsMissions
    .map((id) => {
      const info = infosMission.get(id);
      return info ? { id, ...info, couleur: couleurDe(id) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Lignes de la grille (une par freelance actif affiché dans le planning).
  // Les freelances masqués gardent leurs sélecteurs, affectations et montants :
  // seule la ligne du calendrier disparaît.
  const lignes: LigneFreelance[] = freelancesActifs
    .filter((f) => f.afficherPlanning)
    .map((f) => {
      const cellules: LigneFreelance["cellules"] = {};
      for (const a of affs) {
        if (a.freelanceId === f.id) {
          cellules[a.date] = {
            missionNom: a.missionNom,
            clientNom: a.clientNom,
            couleur: couleurDe(a.missionId),
            tjmAchat: a.tjmAchat,
            tjmVente: a.tjmVente,
          };
        }
      }
      return {
        id: f.id,
        nom: `${f.prenom} ${f.nom}`,
        missions: missionsDispo
          .filter((m) => m.freelanceId === f.id)
          .map((m) => ({
            id: m.id,
            nom: m.nom,
            clientNom: m.clientNom,
            couleur: couleurDe(m.id),
          })),
        cellules,
      };
    });

  // Indicateurs : chaque jour affecté porte son propre TJM (figé à la pose).
  const parMission = new Map<
    number,
    {
      missionId: number;
      missionNom: string;
      clientNom: string;
      freelanceNom: string;
      jours: number;
      ca: number;
      cout: number;
      tjmAchat: number;
      tjmVente: number;
    }
  >();
  for (const a of affs) {
    const e =
      parMission.get(a.missionId) ?? {
        missionId: a.missionId,
        missionNom: a.missionNom,
        clientNom: a.clientNom,
        freelanceNom: `${a.prenom} ${a.nom}`,
        jours: 0,
        ca: 0,
        cout: 0,
        tjmAchat: Number(a.tjmAchat),
        tjmVente: Number(a.tjmVente),
      };
    e.jours += 1;
    e.ca += Number(a.tjmVente);
    e.cout += Number(a.tjmAchat);
    // TJM affiché : celui du dernier jour rencontré dans le mois.
    e.tjmAchat = Number(a.tjmAchat);
    e.tjmVente = Number(a.tjmVente);
    parMission.set(a.missionId, e);
  }

  const arrondi = (n: number) => Math.round(n * 100) / 100;
  const detail = Array.from(parMission.values()).map((e) => ({
    ...e,
    ca: arrondi(e.ca),
    cout: arrondi(e.cout),
    marge: arrondi(e.ca - e.cout),
  }));

  // Totaux du mois = régie (jours posés) + forfait (encaissements / décaissements).
  const totalCa = arrondi(detail.reduce((s, l) => s + l.ca, 0) + caForfait);
  const totalCout = arrondi(detail.reduce((s, l) => s + l.cout, 0) + coutForfait);
  const totalMarge = arrondi(totalCa - totalCout);
  const tauxMarge = totalCa > 0 ? totalMarge / totalCa : 0;

  // --- Détail du mois : missions (régie) ET projets (forfait) réunis ---
  // Colonnes communes : encaissements (argent entrant) / décaissements (argent
  // sortant). Les colonnes Jours et Freelance n'ont de sens que pour les missions.
  type LigneDetail = {
    cle: string;
    libelle: string;
    freelanceNom: string | null;
    clientNom: string;
    encaissements: number;
    decaissements: number;
    jours: number | null;
    marge: number;
  };
  const detailMissions: LigneDetail[] = detail.map((l) => ({
    cle: `m${l.missionId}`,
    libelle: l.missionNom,
    freelanceNom: l.freelanceNom,
    clientNom: l.clientNom,
    encaissements: l.ca, // ce que paie le client (TJM vente × jours)
    decaissements: l.cout, // ce qu'on verse au freelance (TJM achat × jours)
    jours: l.jours,
    marge: l.marge,
  }));

  // Agrégation des flux forfait par projet sur le mois affiché.
  const projAgg = new Map<number, { enc: number; dec: number }>();
  for (const e of encMois) {
    const a = projAgg.get(e.projetId) ?? { enc: 0, dec: 0 };
    a.enc += Number(e.montant);
    projAgg.set(e.projetId, a);
  }
  for (const d of decMois) {
    const a = projAgg.get(d.projetId) ?? { enc: 0, dec: 0 };
    a.dec += Number(d.montant);
    projAgg.set(d.projetId, a);
  }
  const detailProjets: LigneDetail[] = projetsActifs
    .filter((p) => projAgg.has(p.id))
    .map((p) => {
      const a = projAgg.get(p.id)!;
      return {
        cle: `p${p.id}`,
        libelle: p.nom,
        freelanceNom: null, // pas de freelance unique sur un forfait
        clientNom: p.clientNom,
        encaissements: arrondi(a.enc),
        decaissements: arrondi(a.dec),
        jours: null, // notion propre à la régie
        marge: arrondi(a.enc - a.dec),
      };
    });
  const detailLignes = [...detailMissions, ...detailProjets];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/?annee=${precedent.annee}&mois=${precedent.mois}`}
                aria-label="Mois précédent"
              >
                <ChevronLeft />
              </Link>
            }
          />
          <span className="min-w-28 text-center text-sm font-medium capitalize">
            {formatMois(annee, mois)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/?annee=${suivant.annee}&mois=${suivant.mois}`}
                aria-label="Mois suivant"
              >
                <ChevronRight />
              </Link>
            }
          />
        </div>
      </div>

      {/* Indicateurs du mois affiché */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur titre="CA prévisionnel" valeur={formatEuro(totalCa)} />
        <Indicateur titre="Coût total" valeur={formatEuro(totalCout)} />
        <Indicateur titre="Marge totale" valeur={formatEuro(totalMarge)} />
        <Indicateur titre="Taux de marge" valeur={formatPourcent(tauxMarge)} />
      </div>

      {freelancesActifs.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ajoutez des freelances et des missions pour commencer à planifier.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Légende des couleurs + action, juste au-dessus du calendrier */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {legende.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {legende.map((m) => (
                  <span key={m.id} className="flex items-center gap-1.5">
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: m.couleur.bg }}
                    />
                    <span className="font-medium">{m.nom}</span>
                    <span className="text-muted-foreground">({m.clientNom})</span>
                  </span>
                ))}
              </div>
            ) : (
              <div />
            )}
            <EtendreMoisButton
              annee={annee}
              mois={mois}
              libelleMoisSuivant={formatMois(suivant.annee, suivant.mois)}
            />
          </div>

          <PlanningCalendar
            jours={jours}
            lignes={lignes}
            projets={projetsLignes}
            freelancesActifs={freelancesActifs}
            clientsActifs={clientsActifs}
          />
        </>
      )}

      {/* Détail par mission */}
      <Card>
        <CardHeader>
          <CardTitle>Détail du mois</CardTitle>
        </CardHeader>
        <CardContent>
          {detailLignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune activité ce mois-ci. Le détail apparaîtra une fois le planning rempli ou des
              flux forfait enregistrés.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission / Projet</TableHead>
                  <TableHead>Freelance</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Encaissements</TableHead>
                  <TableHead className="text-right">Décaissements</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-right">Marge du mois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLignes.map((l) => (
                  <TableRow key={l.cle}>
                    <TableCell>
                      <EntityLink
                        type={l.cle.startsWith("p") ? "projet" : "mission"}
                        id={Number(l.cle.slice(1))}
                      >
                        {l.libelle}
                      </EntityLink>
                    </TableCell>
                    <TableCell>{l.freelanceNom ?? "-"}</TableCell>
                    <TableCell>{l.clientNom}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.encaissements)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.decaissements)}</TableCell>
                    <TableCell className="text-right">
                      {l.jours !== null ? formatJours(l.jours) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatEuro(l.marge)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatEuro(totalMarge)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
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
        <p className="font-display text-2xl sm:text-3xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
