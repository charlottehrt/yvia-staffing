// Composant serveur : lit les tâches et leurs commentaires de suivi, puis affiche
// la page. Outil de suivi autonome (sans lien avec les données financières).

import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { taches, commentairesTache } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ListViewToolbar } from "@/components/list-view-toolbar";
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
import { TacheFormDialog } from "./tache-form-dialog";
import { TacheRow } from "./tache-row";
import { creerTache } from "./actions";

export default async function PageTaches({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await exigerSession();
  const { vue } = await searchParams;
  const terminees = vue === "terminees";

  // Tâches de l'onglet courant, puis leurs commentaires (du plus récent au plus ancien).
  const liste = await db.select().from(taches).where(eq(taches.termine, terminees));
  const ids = liste.map((t) => t.id);
  const commentaires = ids.length
    ? await db
        .select()
        .from(commentairesTache)
        .where(inArray(commentairesTache.tacheId, ids))
        .orderBy(desc(commentairesTache.creeLe))
    : [];

  const parTache = new Map<number, typeof commentaires>();
  for (const c of commentaires) {
    const arr = parTache.get(c.tacheId) ?? [];
    arr.push(c);
    parTache.set(c.tacheId, arr);
  }

  // Tri par dernière activité : la tâche commentée le plus récemment remonte en tête.
  const lignes = liste
    .map((tache) => {
      const coms = parTache.get(tache.id) ?? [];
      return { tache, commentaires: coms, derniereActivite: coms[0]?.creeLe ?? tache.creeLe };
    })
    .sort((a, b) => (a.derniereActivite < b.derniereActivite ? 1 : -1));

  return (
    <div className="space-y-6">
      <ListViewToolbar
        action={
          <TacheFormDialog
            action={creerTache}
            titre="Nouvelle tâche"
            trigger={<Button>Nouvelle tâche</Button>}
          />
        }
      >
        <Link
          href="/taches"
          className={`rounded-md px-3 py-1.5 text-sm ${
            !terminees
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          À faire
        </Link>
        <Link
          href="/taches?vue=terminees"
          className={`rounded-md px-3 py-1.5 text-sm ${
            terminees
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Terminées
        </Link>
      </ListViewToolbar>

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} tâche{liste.length > 1 ? "s" : ""}
            {terminees ? " terminée" + (liste.length > 1 ? "s" : "") : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {terminees
                ? "Aucune tâche terminée."
                : "Aucune tâche pour l’instant. Cliquez sur « Nouvelle tâche » pour en créer une."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tâche</TableHead>
                  <TableHead>Dernier suivi</TableHead>
                  <TableHead className="text-right">Suivis</TableHead>
                  <TableHead className="text-right">Mise à jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map(({ tache, commentaires }) => (
                  <TacheRow key={tache.id} tache={tache} commentaires={commentaires} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
