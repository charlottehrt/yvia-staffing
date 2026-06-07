import { db } from "@/db";
import { freelances } from "@/db/schema";
import { desc } from "drizzle-orm";
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
import { FreelanceFormDialog } from "./freelance-form-dialog";
import { ToggleActifButton } from "./toggle-actif-button";
import { creerFreelance, modifierFreelance } from "./actions";

export default async function PageFreelances() {
  // Les freelances actifs d'abord, puis par nom.
  const liste = await db
    .select()
    .from(freelances)
    .orderBy(desc(freelances.actif), freelances.nom);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Freelances</h1>
        <FreelanceFormDialog
          action={creerFreelance}
          titre="Nouveau freelance"
          trigger={<Button>Nouveau freelance</Button>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} freelance{liste.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun freelance pour l’instant. Cliquez sur « Nouveau freelance » pour en ajouter un.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((freelance) => (
                  <TableRow key={freelance.id} className={freelance.actif ? "" : "opacity-50"}>
                    <TableCell className="font-medium">
                      {freelance.prenom} {freelance.nom}
                    </TableCell>
                    <TableCell>{freelance.email}</TableCell>
                    <TableCell>{freelance.actif ? "Actif" : "Inactif"}</TableCell>
                    <TableCell className="text-right">
                      <FreelanceFormDialog
                        action={modifierFreelance}
                        freelance={freelance}
                        titre="Modifier le freelance"
                        trigger={
                          <Button variant="ghost" size="sm">
                            Modifier
                          </Button>
                        }
                      />
                      <ToggleActifButton id={freelance.id} actif={freelance.actif} />
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
