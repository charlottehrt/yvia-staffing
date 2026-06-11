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
import { formatEuro, formatPourcent, formatJours, formatMois } from "@/lib/format";
import { StatsFiltres } from "./stats-filtres";
import { PERIODES, GROUPES } from "./stats-config";
import { StatsTable, type LigneStat } from "./stats-table";
import { StatsExport } from "./stats-export";
import { StatsFiltreDrawer } from "./stats-filtre-drawer";
import { exigerSession } from "@/lib/auth/server";

const arrondi = (n: number) => Math.round(n * 100) / 100;

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// Bornes [debut, fin] (texte "AAAA-MM-JJ") selon la période choisie.
// Les périodes prédéfinies sont des fenêtres glissantes en jours se terminant
// aujourd'hui ; "perso" utilise une plage de dates explicite.
function bornesPeriode(
  periode: string,
  debutPerso: string,
  finPerso: string
): { debut: string; fin: string } {
  if (periode === "perso") return { debut: debutPerso, fin: finPerso };
  const n = Number(periode) || 90;
  const fin = new Date();
  const debut = new Date(fin);
  debut.setUTCDate(debut.getUTCDate() - (n - 1));
  return { debut: isoJour(debut), fin: isoJour(fin) };
}

export default async function PageStatistiques({
  searchParams,
}: {
  searchParams: Promise<{
    periode?: string;
    grouper?: string;
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
  const aujourd = isoJour(maintenant);

  const periode = PERIODES.some((p) => p.key === params.periode) ? params.periode! : "90";
  const grouper = GROUPES.some((g) => g.key === params.grouper) ? params.grouper! : "mois";
  const debutPerso = params.debut || aujourd;
  const finPerso = params.fin || aujourd;

  const { debut, fin } = bornesPeriode(periode, debutPerso, finPerso);

  // Filtres optionnels (ids séparés par des virgules dans l'URL).
  const ids = (v?: string) =>
    (v ?? "")
      .split(",")
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
  const selFreelances = ids(params.freelances);
  const selClients = ids(params.clients);
  const selMissions = ids(params.missions);

  const conditions = [gte(affectations.date, debut), lte(affectations.date, fin)];
  if (selFreelances.length) conditions.push(inArray(affectations.freelanceId, selFreelances));
  if (selClients.length) conditions.push(inArray(missions.clientId, selClients));
  if (selMissions.length) conditions.push(inArray(affectations.missionId, selMissions));

  // Tous les jours posés de la période (et des filtres), avec leurs dimensions.
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
    .where(and(...conditions));

  // Listes pour les filtres multi-sélection.
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

  // Forfait : on n'inclut pas les projets si un filtre "missions" est posé (un projet
  // n'est pas une mission). Les encaissements n'ont pas de freelance : on les exclut
  // si un filtre "freelances" est actif.
  const forfaitActif = selMissions.length === 0;
  type EncForfait = { date: string; montant: string; projetId: number; projetNom: string; clientId: number; clientNom: string };
  type DecForfait = EncForfait & { freelanceId: number; freelancePrenom: string; freelanceNom: string };
  let encForfait: EncForfait[] = [];
  let decForfait: DecForfait[] = [];

  if (forfaitActif) {
    if (selFreelances.length === 0) {
      const condEnc = [
        eq(encaissements.statut, "encaisse"), // réalisé uniquement (les stats restent factuelles)
        gte(encaissements.date, debut),
        lte(encaissements.date, fin),
      ];
      if (selClients.length) condEnc.push(inArray(projets.clientId, selClients));
      encForfait = await db
        .select({
          date: encaissements.date,
          montant: encaissements.montant,
          projetId: projets.id,
          projetNom: projets.nom,
          clientId: projets.clientId,
          clientNom: clients.nom,
        })
        .from(encaissements)
        .innerJoin(projets, eq(encaissements.projetId, projets.id))
        .innerJoin(clients, eq(projets.clientId, clients.id))
        .where(and(...condEnc));
    }
    const condDec = [
      eq(decaissements.statut, "decaisse"), // coût réalisé uniquement
      gte(decaissements.date, debut),
      lte(decaissements.date, fin),
    ];
    if (selClients.length) condDec.push(inArray(projets.clientId, selClients));
    if (selFreelances.length) condDec.push(inArray(decaissements.freelanceId, selFreelances));
    decForfait = await db
      .select({
        date: decaissements.date,
        montant: decaissements.montant,
        projetId: projets.id,
        projetNom: projets.nom,
        clientId: projets.clientId,
        clientNom: clients.nom,
        freelanceId: decaissements.freelanceId,
        freelancePrenom: freelances.prenom,
        freelanceNom: freelances.nom,
      })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .innerJoin(clients, eq(projets.clientId, clients.id))
      .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id))
      .where(and(...condDec));
  }

  // Indicateurs globaux : régie (jours posés) + forfait (encaissements / décaissements).
  const caRegie = rows.reduce((s, r) => s + Number(r.tjmVente), 0);
  const coutRegie = rows.reduce((s, r) => s + Number(r.tjmAchat), 0);
  const caForfait = encForfait.reduce((s, e) => s + Number(e.montant), 0);
  const coutForfait = decForfait.reduce((s, d) => s + Number(d.montant), 0);
  const caTotal = arrondi(caRegie + caForfait);
  const coutTotal = arrondi(coutRegie + coutForfait);
  const margeTotale = arrondi(caTotal - coutTotal);
  const tauxMarge = caTotal > 0 ? margeTotale / caTotal : 0;
  const joursTotal = rows.length; // les jours sont une notion de régie
  const margeJour = joursTotal > 0 ? arrondi((caRegie - coutRegie) / joursTotal) : 0;

  // Agrégation par dimension choisie.
  type Acc = { cle: string; label: string; ordreLabel: string; ca: number; cout: number; jours: number };
  const map = new Map<string, Acc>();
  const ajout = (
    cle: string,
    label: string,
    ordreLabel: string,
    ca: number,
    cout: number,
    jours: number
  ) => {
    const g = map.get(cle) ?? { cle, label, ordreLabel, ca: 0, cout: 0, jours: 0 };
    g.ca += ca;
    g.cout += cout;
    g.jours += jours;
    map.set(cle, g);
  };
  const dimMois = (date: string) => {
    const cle = date.slice(0, 7);
    return { cle, label: formatMois(Number(cle.slice(0, 4)), Number(cle.slice(5, 7))), ordre: cle };
  };

  // Régie (jours posés).
  for (const r of rows) {
    if (grouper === "freelance") {
      const label = `${r.freelancePrenom} ${r.freelanceNom}`;
      ajout(`f${r.freelanceId}`, label, label.toLowerCase(), Number(r.tjmVente), Number(r.tjmAchat), 1);
    } else if (grouper === "client") {
      ajout(`c${r.clientId}`, r.clientNom, r.clientNom.toLowerCase(), Number(r.tjmVente), Number(r.tjmAchat), 1);
    } else if (grouper === "mission") {
      ajout(`m${r.missionId}`, r.missionNom, r.missionNom.toLowerCase(), Number(r.tjmVente), Number(r.tjmAchat), 1);
    } else {
      const d = dimMois(r.date);
      ajout(d.cle, d.label, d.ordre, Number(r.tjmVente), Number(r.tjmAchat), 1);
    }
  }

  // Forfait : encaissements (CA). Non attribuable à un freelance.
  for (const e of encForfait) {
    if (grouper === "freelance") continue;
    if (grouper === "client") ajout(`c${e.clientId}`, e.clientNom, e.clientNom.toLowerCase(), Number(e.montant), 0, 0);
    else if (grouper === "mission") ajout(`p${e.projetId}`, e.projetNom, e.projetNom.toLowerCase(), Number(e.montant), 0, 0);
    else {
      const d = dimMois(e.date);
      ajout(d.cle, d.label, d.ordre, Number(e.montant), 0, 0);
    }
  }

  // Forfait : décaissements (coût), rattachés au freelance.
  for (const d2 of decForfait) {
    if (grouper === "freelance") {
      const label = `${d2.freelancePrenom} ${d2.freelanceNom}`;
      ajout(`f${d2.freelanceId}`, label, label.toLowerCase(), 0, Number(d2.montant), 0);
    } else if (grouper === "client") {
      ajout(`c${d2.clientId}`, d2.clientNom, d2.clientNom.toLowerCase(), 0, Number(d2.montant), 0);
    } else if (grouper === "mission") {
      ajout(`p${d2.projetId}`, d2.projetNom, d2.projetNom.toLowerCase(), 0, Number(d2.montant), 0);
    } else {
      const d = dimMois(d2.date);
      ajout(d.cle, d.label, d.ordre, 0, Number(d2.montant), 0);
    }
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
      <Suspense>
        <StatsFiltres periode={periode} grouper={grouper} debut={debutPerso} fin={finPerso}>
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

      {/* Indicateurs de la période */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Indicateur titre="CA" valeur={formatEuro(caTotal)} />
        <Indicateur titre="Coût" valeur={formatEuro(coutTotal)} />
        <Indicateur titre="Marge" valeur={formatEuro(margeTotale)} />
        <Indicateur titre="Taux de marge" valeur={formatPourcent(tauxMarge)} />
        <Indicateur titre="Jours facturés (régie)" valeur={formatJours(joursTotal)} />
        <Indicateur titre="Marge / jour (régie)" valeur={formatEuro(margeJour)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Détail par {labelColonne.toLowerCase()}</CardTitle>
            <StatsExport lignes={lignes} labelColonne={labelColonne} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
