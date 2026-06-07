import Link from "next/link";
import { db } from "@/db";
import { freelances, missions, clients, affectations } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
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
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { FreelanceFormDialog } from "./freelance-form-dialog";
import { FreelanceDetailDialog } from "./freelance-detail-dialog";
import { ToggleActifButton } from "./toggle-actif-button";
import { creerFreelance, modifierFreelance } from "./actions";

export default async function PageFreelances({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue } = await searchParams;
  const archives = vue === "archives";

  // Actifs par défaut ; archivés dans l'onglet Archives.
  const liste = await db
    .select()
    .from(freelances)
    .where(eq(freelances.actif, !archives))
    .orderBy(freelances.nom);

  // Missions par freelance (client + TJM) pour la fiche détaillée.
  const missionsRows = await db
    .select({
      freelanceId: missions.freelanceId,
      missionNom: missions.nom,
      clientNom: clients.nom,
      tjmAchat: missions.tjmAchat,
      tjmVente: missions.tjmVente,
      actif: missions.actif,
    })
    .from(missions)
    .innerJoin(clients, eq(missions.clientId, clients.id));

  type MissionFiche = {
    missionNom: string;
    clientNom: string;
    tjmAchat: string;
    tjmVente: string;
    actif: boolean;
  };
  const missionsParFreelance = new Map<number, MissionFiche[]>();
  for (const m of missionsRows) {
    const arr = missionsParFreelance.get(m.freelanceId) ?? [];
    arr.push({
      missionNom: m.missionNom,
      clientNom: m.clientNom,
      tjmAchat: m.tjmAchat,
      tjmVente: m.tjmVente,
      actif: m.actif,
    });
    missionsParFreelance.set(m.freelanceId, arr);
  }

  // Stats du mois courant par freelance : jours posés + marge.
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  const affsMois = await db
    .select({
      freelanceId: affectations.freelanceId,
      tjmAchat: affectations.tjmAchat,
      tjmVente: affectations.tjmVente,
    })
    .from(affectations)
    .where(
      and(
        gte(affectations.date, premierJourDuMois(annee, mois)),
        lte(affectations.date, dernierJourDuMois(annee, mois))
      )
    );

  const statsParFreelance = new Map<number, { jours: number; marge: number }>();
  for (const a of affsMois) {
    const s = statsParFreelance.get(a.freelanceId) ?? { jours: 0, marge: 0 };
    s.jours += 1;
    s.marge += Number(a.tjmVente) - Number(a.tjmAchat);
    statsParFreelance.set(a.freelanceId, s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Freelances</h1>
        <FreelanceFormDialog
          action={creerFreelance}
          titre="Nouveau freelance"
          trigger={<Button>Nouveau freelance</Button>}
        />
      </div>

      {/* Onglets Actifs / Archives */}
      <div className="flex gap-1">
        <Link
          href="/freelances"
          className={`rounded-md px-3 py-1.5 text-sm ${
            !archives ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Actifs
        </Link>
        <Link
          href="/freelances?vue=archives"
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
            {liste.length} freelance{liste.length > 1 ? "s" : ""}
            {archives ? " archivé" + (liste.length > 1 ? "s" : "") : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {archives
                ? "Aucun freelance archivé."
                : "Aucun freelance pour l’instant. Cliquez sur « Nouveau freelance » pour en ajouter un."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((freelance) => (
                  <TableRow key={freelance.id}>
                    <TableCell>
                      <FreelanceDetailDialog
                        nom={`${freelance.prenom} ${freelance.nom}`}
                        missions={missionsParFreelance.get(freelance.id) ?? []}
                        stats={statsParFreelance.get(freelance.id) ?? { jours: 0, marge: 0 }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <FreelanceFormDialog
                          action={modifierFreelance}
                          freelance={freelance}
                          titre="Modifier le freelance"
                          trigger={
                            <Button variant="outline" size="sm">
                              Modifier
                            </Button>
                          }
                        />
                        <ToggleActifButton id={freelance.id} actif={freelance.actif} />
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
