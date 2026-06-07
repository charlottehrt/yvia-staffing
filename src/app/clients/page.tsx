// Composant serveur : il lit les données directement dans la base, puis affiche la page.

import Link from "next/link";
import { db } from "@/db";
import { clients, missions, freelances, affectations } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientDetailDialog } from "./client-detail-dialog";
import { ArchiveClientButton } from "./archive-client-button";
import { creerClient, modifierClient } from "./actions";

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue } = await searchParams;
  const archives = vue === "archives";

  // Actifs par défaut ; archivés dans l'onglet Archives.
  const liste = await db
    .select()
    .from(clients)
    .where(eq(clients.actif, !archives))
    .orderBy(clients.nom);

  // Missions par client (freelance + TJM vente) pour la fiche détaillée.
  const missionsRows = await db
    .select({
      clientId: missions.clientId,
      missionNom: missions.nom,
      freelanceNom: freelances.nom,
      freelancePrenom: freelances.prenom,
      tjmVente: missions.tjmVente,
      actif: missions.actif,
    })
    .from(missions)
    .innerJoin(freelances, eq(missions.freelanceId, freelances.id));

  type MissionFiche = {
    missionNom: string;
    freelanceNom: string;
    tjmVente: string;
    actif: boolean;
  };
  const missionsParClient = new Map<number, MissionFiche[]>();
  for (const m of missionsRows) {
    const arr = missionsParClient.get(m.clientId) ?? [];
    arr.push({
      missionNom: m.missionNom,
      freelanceNom: `${m.freelancePrenom} ${m.freelanceNom}`,
      tjmVente: m.tjmVente,
      actif: m.actif,
    });
    missionsParClient.set(m.clientId, arr);
  }

  // Stats du mois courant par client : jours facturés + CA.
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  const affsMois = await db
    .select({ clientId: missions.clientId, tjmVente: affectations.tjmVente })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .where(
      and(
        gte(affectations.date, premierJourDuMois(annee, mois)),
        lte(affectations.date, dernierJourDuMois(annee, mois))
      )
    );

  const statsParClient = new Map<number, { jours: number; ca: number }>();
  for (const a of affsMois) {
    const s = statsParClient.get(a.clientId) ?? { jours: 0, ca: 0 };
    s.jours += 1;
    s.ca += Number(a.tjmVente);
    statsParClient.set(a.clientId, s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Clients</h1>
        <ClientFormDialog
          action={creerClient}
          titre="Nouveau client"
          trigger={<Button>Nouveau client</Button>}
        />
      </div>

      {/* Onglets Actifs / Archives */}
      <div className="flex gap-1">
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
      </div>

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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <ClientDetailDialog
                        nom={client.nom}
                        missions={missionsParClient.get(client.id) ?? []}
                        stats={statsParClient.get(client.id) ?? { jours: 0, ca: 0 }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ClientFormDialog
                          action={modifierClient}
                          client={client}
                          titre="Modifier le client"
                          trigger={
                            <Button variant="outline" size="sm">
                              Modifier
                            </Button>
                          }
                        />
                        <ArchiveClientButton id={client.id} actif={client.actif} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
