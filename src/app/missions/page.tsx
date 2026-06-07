import Link from "next/link";
import { db } from "@/db";
import { missions, freelances, clients, tarifs } from "@/db/schema";
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
import { tarifDuMois } from "@/lib/calculs/tarif-du-mois";
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

  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const moisCourant = maintenant.getUTCMonth() + 1;

  // Missions + noms du freelance et du client.
  const missionsRows = await db
    .select({
      id: missions.id,
      freelanceId: missions.freelanceId,
      clientId: missions.clientId,
      actif: missions.actif,
      freelancePrenom: freelances.prenom,
      freelanceNom: freelances.nom,
      clientNom: clients.nom,
    })
    .from(missions)
    .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .orderBy(missions.id);

  const tousTarifs = await db.select().from(tarifs);

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

  const lignes = missionsRows.map((m) => {
    const tarifsMission = tousTarifs
      .filter((t) => t.missionId === m.id)
      .map((t) => ({
        moisEffet: t.moisEffet,
        tjmAchat: Number(t.tjmAchat),
        tjmVente: Number(t.tjmVente),
      }));
    const tarifCourant = tarifDuMois(tarifsMission, annee, moisCourant);
    return { ...m, tarifCourant };
  });

  const lignesAffichees =
    filtreActif === "inactives"
      ? lignes.filter((l) => !l.actif)
      : lignes.filter((l) => l.actif);

  const peutCreer = freelancesActifs.length > 0 && clientsListe.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Missions</h1>
        {peutCreer ? (
          <MissionFormDialog
            action={creerMission}
            titre="Nouvelle mission"
            avecTarif
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
                    <TableCell className="font-medium">
                      {l.freelancePrenom} {l.freelanceNom}
                    </TableCell>
                    <TableCell>{l.clientNom}</TableCell>
                    <TableCell className="text-right">
                      {l.tarifCourant ? formatEuro(l.tarifCourant.tjmAchat) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.tarifCourant ? formatEuro(l.tarifCourant.tjmVente) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.tarifCourant
                        ? formatEuro(l.tarifCourant.tjmVente - l.tarifCourant.tjmAchat)
                        : "-"}
                    </TableCell>
                    <TableCell>{l.actif ? "Actif" : "Inactif"}</TableCell>
                    <TableCell className="text-right">
                      <MissionFormDialog
                        action={modifierMission}
                        titre="Modifier la mission"
                        avecTarif={false}
                        freelancesActifs={freelancesActifs}
                        clientsListe={clientsListe}
                        mission={{
                          id: l.id,
                          freelanceId: l.freelanceId,
                          clientId: l.clientId,
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
