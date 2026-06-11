import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/cal-sans/400.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./sidebar";
import { DrawerProvider } from "./_drawer/drawer-stack";
import { estAdmin } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Yvia - Dashboard",
  description: "Pilotage de la marge des freelances en mission",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // En-tête (logo + navigation + déconnexion) affiché uniquement si connecté.
  const session = await getSession();
  const [utilisateur] = session
    ? await db
        .select({ prenom: users.prenom, nom: users.nom })
        .from(users)
        .where(eq(users.id, session.userId))
    : [];
  const nomAffiche =
    [utilisateur?.prenom, utilisateur?.nom].filter(Boolean).join(" ") || session?.email || "";

  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">
        {session ? (
          <DrawerProvider>
            <div className="flex min-h-screen">
              <Sidebar nomAffiche={nomAffiche} admin={estAdmin(session)} />
              <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
            </div>
          </DrawerProvider>
        ) : (
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        )}
        <Toaster />
      </body>
    </html>
  );
}
