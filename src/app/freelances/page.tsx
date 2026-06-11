import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { freelances, affectations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FreelanceFormDialog } from "./freelance-form-dialog";
import { FreelanceRow } from "./freelance-row";
import { creerFreelance } from "./actions";

export default async function PageFreelances({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await exigerSession();
  const { vue } = await searchParams;
  const archives = vue === "archives";

  const liste = await db
    .select()
    .from(freelances)
    .where(eq(freelances.actif, !archives))
    .orderBy(freelances.nom);

  const affs = await db
    .select({
      freelanceId: affectations.freelanceId,
      tjmAchat: affectations.tjmAchat,
      tjmVente: affectations.tjmVente,
    })
    .from(affectations);
  const gainParFreelance = new Map<number, number>();
  for (const a of affs) {
    const g = gainParFreelance.get(a.freelanceId) ?? 0;
    gainParFreelance.set(a.freelanceId, g + (Number(a.tjmVente) - Number(a.tjmAchat)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <FreelanceFormDialog
          action={creerFreelance}
          titre="Nouveau freelance"
          trigger={<Button>Nouveau freelance</Button>}
        />
      </div>

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
                  <TableHead className="text-right">Gain rapporté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((freelance) => (
                  <FreelanceRow
                    key={freelance.id}
                    id={freelance.id}
                    nom={`${freelance.prenom} ${freelance.nom}`}
                    gain={gainParFreelance.get(freelance.id) ?? 0}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
