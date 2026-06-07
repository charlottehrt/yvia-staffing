// Composant serveur : il lit les données directement dans la base, puis affiche la page.

import { db } from "@/db";
import { clients, missions, freelances } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
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
import { ClientFormDialog } from "./client-form-dialog";
import { ClientDetailDialog } from "./client-detail-dialog";
import { ArchiveClientButton } from "./archive-client-button";
import { creerClient, modifierClient } from "./actions";

export default async function PageClients() {
  // Clients actifs d'abord, puis par nom.
  const liste = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.actif), clients.nom);

  // Freelances placés par client, pour la fiche détaillée.
  const missionsRows = await db
    .select({
      clientId: missions.clientId,
      freelanceNom: freelances.nom,
      freelancePrenom: freelances.prenom,
    })
    .from(missions)
    .innerJoin(freelances, eq(missions.freelanceId, freelances.id));

  const missionsParClient = new Map<number, { freelanceNom: string }[]>();
  for (const m of missionsRows) {
    const arr = missionsParClient.get(m.clientId) ?? [];
    arr.push({ freelanceNom: `${m.freelancePrenom} ${m.freelanceNom}` });
    missionsParClient.set(m.clientId, arr);
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

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} client{liste.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun client pour l’instant. Cliquez sur « Nouveau client » pour en ajouter un.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Société</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((client) => (
                  <TableRow key={client.id} className={client.actif ? "" : "opacity-50"}>
                    <TableCell>
                      <ClientDetailDialog
                        nom={client.nom}
                        missions={missionsParClient.get(client.id) ?? []}
                      />
                    </TableCell>
                    <TableCell>{client.actif ? "Actif" : "Archivé"}</TableCell>
                    <TableCell className="text-right">
                      <ClientFormDialog
                        action={modifierClient}
                        client={client}
                        titre="Modifier le client"
                        trigger={
                          <Button variant="ghost" size="sm">
                            Modifier
                          </Button>
                        }
                      />
                      <ArchiveClientButton id={client.id} actif={client.actif} />
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
