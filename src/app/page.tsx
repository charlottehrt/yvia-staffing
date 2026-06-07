import Link from "next/link";
import { db } from "@/db";
import { missions, freelances, clients, tarifs, affectations } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
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
import { tarifDuMois } from "@/lib/calculs/tarif-du-mois";
import { calculMarge } from "@/lib/calculs/marge";
import { estJourFerie } from "@/lib/calculs/jours-feries";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { formatEuro, formatPourcent, formatJours, formatMois } from "@/lib/format";
import { PlanningCalendar, type Couleur, type LigneFreelance, type Jour } from "./planning-calendar";

const pad2 = (n: number) => String(n).padStart(2, "0");
const moisSuivant = (a: number, m: number) =>
  m === 12 ? { annee: a + 1, mois: 1 } : { annee: a, mois: m + 1 };
const moisPrecedent = (a: number, m: number) =>
  m === 1 ? { annee: a - 1, mois: 12 } : { annee: a, mois: m - 1 };

// Palette pour distinguer les missions dans le planning.
const PALETTE: Couleur[] = [
  { bg: "#0571ed", fg: "#ffffff" },
  { bg: "#0b172b", fg: "#ffffff" },
  { bg: "#3794ff", fg: "#ffffff" },
  { bg: "#52698f", fg: "#ffffff" },
  { bg: "#0f5bb3", fg: "#ffffff" },
  { bg: "#a5d8e1", fg: "#0b172b" },
];

const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];

export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; mois?: string }>;
}) {
  const params = await searchParams;
  const maintenant = new Date();
  const annee = Number(params.annee) || maintenant.getUTCFullYear();
  const moisParam = Number(params.mois);
  const mois = moisParam >= 1 && moisParam <= 12 ? moisParam : maintenant.getUTCMonth() + 1;

  const suivant = moisSuivant(annee, mois);
  const precedent = moisPrecedent(annee, mois);
  const debutMois = premierJourDuMois(annee, mois);
  const finMois = dernierJourDuMois(annee, mois);

  // Jours du mois (avec week-ends et jours fériés).
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
    });
  }

  // Données.
  const freelancesActifs = await db
    .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom })
    .from(freelances)
    .where(eq(freelances.actif, true))
    .orderBy(freelances.nom);

  const missionsDispo = await db
    .select({
      id: missions.id,
      freelanceId: missions.freelanceId,
      clientNom: clients.nom,
    })
    .from(missions)
    .innerJoin(clients, eq(missions.clientId, clients.id));

  const affs = await db
    .select({
      freelanceId: affectations.freelanceId,
      date: affectations.date,
      missionId: affectations.missionId,
      clientNom: clients.nom,
      prenom: freelances.prenom,
      nom: freelances.nom,
    })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .innerJoin(freelances, eq(affectations.freelanceId, freelances.id))
    .where(and(gte(affectations.date, debutMois), lte(affectations.date, finMois)));

  const tousTarifs = await db.select().from(tarifs);

  // Couleur stable par mission.
  const idsMissions = Array.from(
    new Set([...missionsDispo.map((m) => m.id), ...affs.map((a) => a.missionId)])
  ).sort((a, b) => a - b);
  const couleurDe = (missionId: number): Couleur =>
    PALETTE[idsMissions.indexOf(missionId) % PALETTE.length];

  // Lignes de la grille (une par freelance actif).
  const lignes: LigneFreelance[] = freelancesActifs.map((f) => {
    const cellules: LigneFreelance["cellules"] = {};
    for (const a of affs) {
      if (a.freelanceId === f.id) {
        cellules[a.date] = { clientNom: a.clientNom, couleur: couleurDe(a.missionId) };
      }
    }
    return {
      id: f.id,
      nom: `${f.prenom} ${f.nom}`,
      missions: missionsDispo
        .filter((m) => m.freelanceId === f.id)
        .map((m) => ({ id: m.id, clientNom: m.clientNom, couleur: couleurDe(m.id) })),
      cellules,
    };
  });

  // Indicateurs : à partir des jours réellement affectés ce mois-ci.
  const parMission = new Map<
    number,
    { missionId: number; clientNom: string; freelanceNom: string; jours: number }
  >();
  for (const a of affs) {
    const e =
      parMission.get(a.missionId) ?? {
        missionId: a.missionId,
        clientNom: a.clientNom,
        freelanceNom: `${a.prenom} ${a.nom}`,
        jours: 0,
      };
    e.jours += 1;
    parMission.set(a.missionId, e);
  }

  const detail = Array.from(parMission.values()).map((e) => {
    const ts = tousTarifs
      .filter((t) => t.missionId === e.missionId)
      .map((t) => ({
        moisEffet: t.moisEffet,
        tjmAchat: Number(t.tjmAchat),
        tjmVente: Number(t.tjmVente),
      }));
    const tarif = tarifDuMois(ts, annee, mois);
    const r = tarif
      ? calculMarge(e.jours, tarif.tjmAchat, tarif.tjmVente)
      : { ca: 0, cout: 0, marge: 0, tauxMarge: 0 };
    return {
      ...e,
      tjmAchat: tarif?.tjmAchat ?? null,
      tjmVente: tarif?.tjmVente ?? null,
      ...r,
    };
  });

  const totalCa = detail.reduce((s, l) => s + l.ca, 0);
  const totalCout = detail.reduce((s, l) => s + l.cout, 0);
  const totalMarge = detail.reduce((s, l) => s + l.marge, 0);
  const tauxMarge = totalCa > 0 ? totalMarge / totalCa : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Planning</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/?annee=${precedent.annee}&mois=${precedent.mois}`}>Mois précédent</Link>}
          />
          <span className="min-w-40 text-center text-sm font-medium capitalize">
            {formatMois(annee, mois)}
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/?annee=${suivant.annee}&mois=${suivant.mois}`}>Mois suivant</Link>}
          />
        </div>
      </div>

      {/* Indicateurs (au-dessus du planning) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-sm text-muted-foreground">
            Cliquez-glissez sur une ligne pour sélectionner des jours, puis choisissez la mission.
          </p>
          <PlanningCalendar jours={jours} lignes={lignes} />
        </>
      )}

      {/* Détail par mission */}
      <Card>
        <CardHeader>
          <CardTitle>Détail du mois</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun jour affecté ce mois-ci. Le détail apparaîtra une fois le planning rempli.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Freelance</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">TJM achat</TableHead>
                  <TableHead className="text-right">TJM vente</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-right">Marge du mois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.map((l) => (
                  <TableRow key={l.missionId}>
                    <TableCell className="font-medium">{l.freelanceNom}</TableCell>
                    <TableCell>{l.clientNom}</TableCell>
                    <TableCell className="text-right">
                      {l.tjmAchat !== null ? formatEuro(l.tjmAchat) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.tjmVente !== null ? formatEuro(l.tjmVente) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatJours(l.jours)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.marge)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-medium">
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
        <p className="font-display text-3xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
