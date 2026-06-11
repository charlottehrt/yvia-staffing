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
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatPourcent, formatMois } from "@/lib/format";
import { premierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { StatsFiltres } from "./stats-filtres";
import { PERIODES } from "./stats-config";
import { StatsFiltreDrawer } from "./stats-filtre-drawer";
import { exigerSession } from "@/lib/auth/server";
import {
  calculerPilotageMensuel,
  type DecaissementPilotage,
  type EncaissementPilotage,
  type LignePrevisionnel,
  type LigneRealise,
} from "./pilotage-calculs";
import { TableauPrevisionnel } from "./tableau-previsionnel";

type DecaissementPrevuRow = DecaissementPilotage & {
  projetNom: string;
  clientNom: string;
  freelancePrenom: string;
  freelanceNomDb: string;
  libelle: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoJour = (d: Date) => d.toISOString().slice(0, 10);

function bornesPilotage(
  periode: string,
  debutPerso: string,
  finPerso: string,
  maintenant: Date
) {
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  const debutMoisCourant = premierJourDuMois(annee, mois);

  if (periode === "perso") {
    return {
      debutRealise: debutPerso,
      finRealise: finPerso,
      debutPrevisionnel: debutMoisCourant,
      finPrevisionnel: finPerso,
    };
  }

  const n = Number(periode) || 365;
  const debutRealise = new Date(maintenant);
  debutRealise.setUTCDate(debutRealise.getUTCDate() - (n - 1));
  const finPrevisionnel = new Date(maintenant);
  finPrevisionnel.setUTCDate(finPrevisionnel.getUTCDate() + n);

  return {
    debutRealise: isoJour(debutRealise),
    finRealise: isoJour(maintenant),
    debutPrevisionnel: debutMoisCourant,
    finPrevisionnel: isoJour(finPrevisionnel),
  };
}

function ids(v?: string) {
  return (v ?? "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default async function PageStatistiques({
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
  const aujourd = isoJour(maintenant);
  const moisCourant = `${maintenant.getUTCFullYear()}-${pad2(maintenant.getUTCMonth() + 1)}`;

  const periode = PERIODES.some((p) => p.key === params.periode) ? params.periode! : "365";
  const debutPerso = params.debut || aujourd;
  const finPerso = params.fin || aujourd;
  const { debutRealise, finRealise, debutPrevisionnel, finPrevisionnel } = bornesPilotage(
    periode,
    debutPerso,
    finPerso,
    maintenant
  );

  const selFreelances = ids(params.freelances);
  const selClients = ids(params.clients);
  const selMissions = ids(params.missions);
  const forfaitActif = selMissions.length === 0;

  const optionsPromise = Promise.all([
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

  const condRegie = [gte(affectations.date, debutPrevisionnel), lte(affectations.date, finPrevisionnel)];
  if (selFreelances.length) condRegie.push(inArray(affectations.freelanceId, selFreelances));
  if (selClients.length) condRegie.push(inArray(missions.clientId, selClients));
  if (selMissions.length) condRegie.push(inArray(affectations.missionId, selMissions));
  const affsPromise = db
    .select({
      date: affectations.date,
      tjmAchat: affectations.tjmAchat,
      tjmVente: affectations.tjmVente,
      freelancePrenom: freelances.prenom,
      freelanceNomDb: freelances.nom,
      missionNom: missions.nom,
      clientNom: clients.nom,
    })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .innerJoin(freelances, eq(affectations.freelanceId, freelances.id))
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .where(and(...condRegie));

  let encaissementsRealisesPromise: Promise<EncaissementPilotage[]> = Promise.resolve([]);
  let encaissementsPrevusPromise: Promise<EncaissementPilotage[]> = Promise.resolve([]);
  let decaissementsRealisesPromise: Promise<DecaissementPilotage[]> = Promise.resolve([]);
  let decaissementsPrevusPromise: Promise<DecaissementPrevuRow[]> = Promise.resolve([]);

  if (forfaitActif) {
    if (selFreelances.length === 0) {
      const condEncRealises = [
        eq(encaissements.statut, "encaisse"),
        eq(projets.actif, true),
        ne(projets.statutCommercial, "perdu"),
        gte(encaissements.date, debutRealise),
        lte(encaissements.date, finRealise),
      ];
      if (selClients.length) condEncRealises.push(inArray(projets.clientId, selClients));
      encaissementsRealisesPromise = db
        .select({
          date: encaissements.date,
          montant: encaissements.montant,
          statut: encaissements.statut,
          fiabilite: encaissements.fiabilite,
        })
        .from(encaissements)
        .innerJoin(projets, eq(encaissements.projetId, projets.id))
        .where(and(...condEncRealises));

      const condEncPrevus = [
        eq(encaissements.statut, "prevu"),
        eq(projets.actif, true),
        ne(projets.statutCommercial, "perdu"),
        gte(encaissements.date, debutPrevisionnel),
        lte(encaissements.date, finPrevisionnel),
      ];
      if (selClients.length) condEncPrevus.push(inArray(projets.clientId, selClients));
      encaissementsPrevusPromise = db
        .select({
          date: encaissements.date,
          montant: encaissements.montant,
          statut: encaissements.statut,
          fiabilite: encaissements.fiabilite,
          projetNom: projets.nom,
          clientNom: clients.nom,
          libelle: encaissements.libelle,
        })
        .from(encaissements)
        .innerJoin(projets, eq(encaissements.projetId, projets.id))
        .innerJoin(clients, eq(projets.clientId, clients.id))
        .where(and(...condEncPrevus));
    }

    const condDecRealises = [
      eq(decaissements.statut, "decaisse"),
      eq(projets.actif, true),
      ne(projets.statutCommercial, "perdu"),
      gte(decaissements.date, debutRealise),
      lte(decaissements.date, finRealise),
    ];
    if (selClients.length) condDecRealises.push(inArray(projets.clientId, selClients));
    if (selFreelances.length) condDecRealises.push(inArray(decaissements.freelanceId, selFreelances));
    decaissementsRealisesPromise = db
      .select({
        date: decaissements.date,
        montant: decaissements.montant,
        statut: decaissements.statut,
      })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .where(and(...condDecRealises));

    const condDecPrevus = [
      eq(decaissements.statut, "prevu"),
      eq(projets.actif, true),
      ne(projets.statutCommercial, "perdu"),
      gte(decaissements.date, debutPrevisionnel),
      lte(decaissements.date, finPrevisionnel),
    ];
    if (selClients.length) condDecPrevus.push(inArray(projets.clientId, selClients));
    if (selFreelances.length) condDecPrevus.push(inArray(decaissements.freelanceId, selFreelances));
    decaissementsPrevusPromise = db
      .select({
        date: decaissements.date,
        montant: decaissements.montant,
        statut: decaissements.statut,
        projetNom: projets.nom,
        clientNom: clients.nom,
        freelancePrenom: freelances.prenom,
        freelanceNomDb: freelances.nom,
        libelle: decaissements.libelle,
      })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .innerJoin(clients, eq(projets.clientId, clients.id))
      .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id))
      .where(and(...condDecPrevus));
  }

  const [
    affs,
    encaissementsRealises,
    encaissementsPrevus,
    decaissementsRealises,
    decaissementsPrevus,
    [optFreelances, optClients, optMissions],
  ] = await Promise.all([
    affsPromise,
    encaissementsRealisesPromise,
    encaissementsPrevusPromise,
    decaissementsRealisesPromise,
    decaissementsPrevusPromise,
    optionsPromise,
  ]);

  const pilotage = calculerPilotageMensuel({
    debutPrevisionnel,
    finPrevisionnel,
    affectations: affs.map((a) => ({
      date: a.date,
      tjmAchat: a.tjmAchat,
      tjmVente: a.tjmVente,
      freelanceNom: `${a.freelancePrenom} ${a.freelanceNomDb}`,
      missionNom: a.missionNom,
      clientNom: a.clientNom,
    })),
    encaissements: [...encaissementsRealises, ...encaissementsPrevus],
    decaissements: [
      ...decaissementsRealises,
      ...decaissementsPrevus.map((d) => ({
        date: d.date,
        montant: d.montant,
        statut: d.statut,
        projetNom: d.projetNom,
        clientNom: d.clientNom,
        freelanceNom: `${d.freelancePrenom} ${d.freelanceNomDb}`,
        libelle: d.libelle,
      })),
    ],
  });

  const totalRealise = totaliserRealise(pilotage.realise);
  const totalPrevisionnel = totaliserPrevisionnel(pilotage.previsionnel);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur titre="CA encaissé" valeur={formatEuro(totalRealise.ca)} />
        <Indicateur titre="Marge réalisée" valeur={formatEuro(totalRealise.marge)} />
        <Indicateur titre="CA probable" valeur={formatEuro(totalPrevisionnel.caProb)} />
        <Indicateur titre="Marge probable cumulée" valeur={formatEuro(totalPrevisionnel.cumulProb)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilotage mensuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Réalisé</h2>
                <p className="text-xs text-muted-foreground">Mois passés et mois courant</p>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mois courant inclus :{" "}
                {formatMois(Number(moisCourant.slice(0, 4)), Number(moisCourant.slice(5, 7)))}
              </p>
            </div>
            {pilotage.realise.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Aucun encaissement ou décaissement réalisé sur cette fenêtre.
              </p>
            ) : (
              <TableauRealise lignes={pilotage.realise} />
            )}
          </section>

          <div className="border-t border-border" />

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Prévisionnel</h2>
                <p className="text-xs text-muted-foreground">Mois courant et mois futurs</p>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Freelances inclus
              </p>
            </div>
            {pilotage.previsionnel.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Aucune donnée prévisionnelle sur cette fenêtre.
              </p>
            ) : (
              <TableauPrevisionnel lignes={pilotage.previsionnel} />
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function totaliserRealise(lignes: LigneRealise[]) {
  const total = lignes.reduce(
    (s, l) => ({ ca: s.ca + l.ca, cout: s.cout + l.cout, marge: s.marge + l.marge }),
    { ca: 0, cout: 0, marge: 0 }
  );
  return {
    ca: total.ca,
    cout: total.cout,
    marge: total.marge,
    taux: total.ca > 0 ? total.marge / total.ca : 0,
  };
}

function totaliserPrevisionnel(lignes: LignePrevisionnel[]) {
  const total = lignes.reduce(
    (s, l) => ({
      caMax: s.caMax + l.caMax,
      caProb: s.caProb + l.caProb,
      charges: s.charges + l.charges,
      margeMax: s.margeMax + l.margeMax,
      margeProb: s.margeProb + l.margeProb,
    }),
    { caMax: 0, caProb: 0, charges: 0, margeMax: 0, margeProb: 0 }
  );
  return {
    ...total,
    cumulProb: lignes.length ? lignes[lignes.length - 1].cumulProb : 0,
  };
}

function TableauRealise({ lignes }: { lignes: LigneRealise[] }) {
  const total = totaliserRealise(lignes);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mois</TableHead>
          <TableHead className="text-right">CA encaissé</TableHead>
          <TableHead className="text-right">Coûts décaissés</TableHead>
          <TableHead className="text-right">Marge réalisée</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l) => (
          <TableRow key={l.cle}>
            <TableCell className="font-medium capitalize">{formatMois(l.annee, l.mois)}</TableCell>
            <TableCell className="text-right">{formatEuro(l.ca)}</TableCell>
            <TableCell className="text-right text-rose-600">{formatEuro(l.cout)}</TableCell>
            <TableCell className={`text-right ${l.marge < 0 ? "text-rose-600" : ""}`}>
              {formatEuro(l.marge)}
            </TableCell>
            <TableCell className="text-right">{formatPourcent(l.taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatEuro(total.ca)}</TableCell>
          <TableCell className="text-right">{formatEuro(total.cout)}</TableCell>
          <TableCell className={`text-right ${total.marge < 0 ? "text-rose-600" : ""}`}>
            {formatEuro(total.marge)}
          </TableCell>
          <TableCell className="text-right">{formatPourcent(total.taux)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
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
