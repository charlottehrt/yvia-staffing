import Link from "next/link";
import { db } from "@/db";
import { missions, freelances, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro } from "@/lib/format";
import { MissionFormDialog } from "./mission-form-dialog";
import { ToggleActifMissionButton } from "./toggle-actif-mission-button";
import { creerMission, modifierMission } from "./actions";

const filtres = [
  { slug: "actives", label: "Actives" },
  { slug: "inactives", label: "Inactives" },
] as const;

export default async function PageMissions({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut: filtreActif = "actives" } = await searchParams;

  // Missions + noms du freelance et du client.
  const missionsRows = await db
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
    .orderBy(missions.id);

  // Listes pour les menus déroulants du formulaire.
  const freelancesActifs = await db
    .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom })
    .from(freelances)
    .where(eq(freelances.actif, true))
    .orderBy(freelances.nom);
  const clientsListe = await db
    .select({ id: clients.id, nom: clients.nom })
    .from(clients)
    .where(eq(clients.actif, true))
    .orderBy(clients.nom);

  const lignesAffichees =
    filtreActif === "inactives"
      ? missionsRows.filter((l) => !l.actif)
      : missionsRows.filter((l) => l.actif);

  const peutCreer = freelancesActifs.length > 0 && clientsListe.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Missions</h1>
        {peutCreer ? (
          <MissionFormDialog
            action={creerMission}
            titre="Nouvelle mission"
            freelancesActifs={freelancesActifs}
            clientsListe={clientsListe}
            trigger={<Button>Nouvelle mission</Button>}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Ajoutez d’abord au moins un freelance et un client.
          </p>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {lignesAffichees.length} mission{lignesAffichees.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lignesAffichees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune mission à afficher.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead>
                  <TableHead>Freelance</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">TJM achat</TableHead>
                  <TableHead className="text-right">TJM vente</TableHead>
                  <TableHead className="text-right">Marge/jour</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignesAffichees.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nom}</TableCell>
                    <TableCell>
                      {l.freelancePrenom} {l.freelanceNom}
                    </TableCell>
                    <TableCell>{l.clientNom}</TableCell>
                    <TableCell className="text-right">{formatEuro(Number(l.tjmAchat))}</TableCell>
                    <TableCell className="text-right">{formatEuro(Number(l.tjmVente))}</TableCell>
                    <TableCell className="text-right">
                      {formatEuro(Number(l.tjmVente) - Number(l.tjmAchat))}
                    </TableCell>
                    <TableCell>{l.actif ? "Actif" : "Inactif"}</TableCell>
                    <TableCell className="text-right">
                      <MissionFormDialog
                        action={modifierMission}
                        titre="Modifier la mission"
                        freelancesActifs={freelancesActifs}
                        clientsListe={clientsListe}
                        mission={{
                          id: l.id,
                          nom: l.nom,
                          freelanceId: l.freelanceId,
                          clientId: l.clientId,
                          tjmAchat: l.tjmAchat,
                          tjmVente: l.tjmVente,
                        }}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Modifier
                          </Button>
                        }
                      />
                      <ToggleActifMissionButton id={l.id} actif={l.actif} />
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
