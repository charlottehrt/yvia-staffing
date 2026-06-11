// Composant serveur : il lit les données directement dans la base, puis affiche la page.

import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import {
  affectations,
  clients,
  decaissements,
  encaissements,
  missions,
  projets,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ListViewToolbar } from "@/components/list-view-toolbar";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientRow } from "./client-row";
import { creerClient } from "./actions";
import { calculerStatsClients, type StatsClient } from "./client-stats";

const statsVides: StatsClient = {
  caTotal: 0,
  caMois: 0,
  margeTotale: 0,
};

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await exigerSession();
  const { vue } = await searchParams;
  const archives = vue === "archives";
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  const debutMois = premierJourDuMois(annee, mois);
  const finMois = dernierJourDuMois(annee, mois);

  // Actifs par défaut ; archivés dans l'onglet Archives.
  const [liste, regie, encaissementsForfait, decaissementsForfait] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(eq(clients.actif, !archives))
      .orderBy(clients.nom),
    db
      .select({
        clientId: missions.clientId,
        date: affectations.date,
        tjmAchat: affectations.tjmAchat,
        tjmVente: affectations.tjmVente,
      })
      .from(affectations)
      .innerJoin(missions, eq(affectations.missionId, missions.id)),
    db
      .select({
        clientId: projets.clientId,
        date: encaissements.date,
        montant: encaissements.montant,
      })
      .from(encaissements)
      .innerJoin(projets, eq(encaissements.projetId, projets.id))
      .where(eq(encaissements.statut, "encaisse")),
    db
      .select({
        clientId: projets.clientId,
        date: decaissements.date,
        montant: decaissements.montant,
      })
      .from(decaissements)
      .innerJoin(projets, eq(decaissements.projetId, projets.id))
      .where(eq(decaissements.statut, "decaisse")),
  ]);
  const statsParClient = calculerStatsClients({
    regie,
    encaissements: encaissementsForfait,
    decaissements: decaissementsForfait,
    debutMois,
    finMois,
  });

  return (
    <div className="space-y-6">
      <ListViewToolbar
        action={
          <ClientFormDialog
            action={creerClient}
            titre="Nouveau client"
            trigger={<Button>Nouveau client</Button>}
          />
        }
      >
        <Link
          href="/clients"
          className={`rounded-md px-3 py-1.5 text-sm ${
            !archives ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Actifs
        </Link>
        <Link
          href="/clients?vue=archives"
          className={`rounded-md px-3 py-1.5 text-sm ${
            archives ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Archives
        </Link>
      </ListViewToolbar>

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} client{liste.length > 1 ? "s" : ""}
            {archives ? " archivé" + (liste.length > 1 ? "s" : "") : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {archives
                ? "Aucun client archivé."
                : "Aucun client pour l’instant. Cliquez sur « Nouveau client » pour en ajouter un."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Société</TableHead>
                  <TableHead className="text-right">CA depuis le début</TableHead>
                  <TableHead className="text-right">CA du mois</TableHead>
                  <TableHead className="text-right">Marge totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((client) => {
                  const stats = statsParClient.get(client.id) ?? statsVides;
                  return <ClientRow key={client.id} id={client.id} nom={client.nom} {...stats} />;
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
