import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { missions, freelances, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListViewToolbar } from "@/components/list-view-toolbar";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MissionFormDialog } from "./mission-form-dialog";
import { MissionRow } from "./mission-row";
import { creerMission } from "./actions";

const filtres = [
  { slug: "actives", label: "Actives" },
  { slug: "inactives", label: "Inactives" },
] as const;

export default async function PageMissions({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await exigerSession();
  const { statut: filtreActif = "actives" } = await searchParams;

  const [missionsRows, freelancesActifs, clientsActifs] = await Promise.all([
    db
      .select({
        id: missions.id,
        nom: missions.nom,
        freelanceId: missions.freelanceId,
        clientId: missions.clientId,
        tjmAchat: missions.tjmAchat,
        tjmVente: missions.tjmVente,
        actif: missions.actif,
        freelancePrenom: freelances.prenom,
        freelanceNom: freelances.nom,
        clientNom: clients.nom,
      })
      .from(missions)
      .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
      .innerJoin(clients, eq(missions.clientId, clients.id))
      .orderBy(missions.id),
    db
      .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom })
      .from(freelances)
      .where(eq(freelances.actif, true))
      .orderBy(freelances.nom),
    db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.actif, true))
      .orderBy(clients.nom),
  ]);

  const actives = filtreActif !== "inactives";
  const liste = missionsRows.filter((m) => m.actif === actives);

  return (
    <div className="space-y-6">
      <ListViewToolbar
        action={
          <MissionFormDialog
            action={creerMission}
            titre="Nouvelle mission"
            freelancesActifs={freelancesActifs}
            clientsListe={clientsActifs}
            trigger={<Button>Nouvelle mission</Button>}
          />
        }
      >
        {filtres.map((f) => (
          <Link
            key={f.slug}
            href={`/missions?statut=${f.slug}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filtreActif === f.slug
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </ListViewToolbar>

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} mission{liste.length > 1 ? "s" : ""}
            {!actives ? " inactive" + (liste.length > 1 ? "s" : "") : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {actives ? "Aucune mission active." : "Aucune mission inactive."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead>
                  <TableHead>Freelance</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">TJM achat</TableHead>
                  <TableHead className="text-right">TJM vente</TableHead>
                  <TableHead className="text-right">Marge / jour</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((mission) => (
                  <MissionRow key={mission.id} l={mission} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
