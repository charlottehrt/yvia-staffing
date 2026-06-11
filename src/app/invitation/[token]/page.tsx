import Image from "next/image";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccepterForm } from "./accepter-form";

export default async function PageInvitation({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
  const valide = !!inv && !inv.utilisee && new Date(inv.expireLe) > new Date();

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <Image src="/logo-yvia.svg" alt="Yvia" width={107} height={40} className="h-8 w-auto" priority />
          <CardTitle>{valide ? "Créer votre compte" : "Invitation invalide"}</CardTitle>
        </CardHeader>
        <CardContent>
          {valide ? (
            <AccepterForm token={token} email={inv.email} nom={inv.nom ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Ce lien d&apos;invitation est invalide, expiré ou déjà utilisé. Demandez un nouveau lien à
              votre associé.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
