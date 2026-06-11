// Composant serveur : il lit les données directement dans la base, puis affiche la page.

import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
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
import { EntityLink } from "@/app/_drawer/drawer-stack";
import { ClientFormDialog } from "./client-form-dialog";
import { creerClient } from "./actions";

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await exigerSession();
  const { vue } = await searchParams;
  const archives = vue === "archives";

  // Actifs par défaut ; archivés dans l'onglet Archives.
  const liste = await db
    .select()
    .from(clients)
    .where(eq(clients.actif, !archives))
    .orderBy(clients.nom);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <ClientFormDialog
          action={creerClient}
          titre="Nouveau client"
          trigger={<Button>Nouveau client</Button>}
        />
      </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <EntityLink type="client" id={client.id}>
                        {client.nom}
                      </EntityLink>
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
