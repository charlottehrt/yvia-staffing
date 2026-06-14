import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { getSession } from "@/lib/auth/server";
import { estAdmin } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "./password-form";
import { ApiKeysCard } from "./api-keys-card";
import { creerCleApi, revoquerCleApi } from "./api-keys-actions";

export default async function PageParametres() {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = estAdmin(session);
  const nomComplet = [session.prenom, session.nom].filter(Boolean).join(" ");

  // Clés API de l'utilisateur connecté + URL publique de l'endpoint MCP.
  const cles = await db
    .select({
      id: apiKeys.id,
      nom: apiKeys.nom,
      prefixe: apiKeys.prefixe,
      creeLe: apiKeys.creeLe,
      dernierUsageLe: apiKeys.dernierUsageLe,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.userId))
    .orderBy(desc(apiKeys.creeLe));

  const enTetes = await headers();
  const hote = enTetes.get("x-forwarded-host") ?? enTetes.get("host") ?? "localhost:3000";
  const protocole =
    enTetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const mcpUrl = `${protocole}://${hote}/api/mcp`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Mon compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Email : </span>
            {session.email}
          </p>
          {nomComplet ? (
            <p>
              <span className="text-muted-foreground">Nom : </span>
              {nomComplet}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Rôle : </span>
            {admin ? "Administrateur" : "Utilisateur"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <ApiKeysCard
        mcpUrl={mcpUrl}
        cles={cles}
        creer={creerCleApi}
        revoquer={revoquerCleApi}
      />
    </div>
  );
}
