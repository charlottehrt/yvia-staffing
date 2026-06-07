import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource/cal-sans/400.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NavLinks } from "./nav-links";
import { LogoutButton } from "./logout-button";
import { verifierSession, SESSION_COOKIE } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Yvia - Suivi de marge",
  description: "Pilotage de la marge des freelances en mission",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // En-tête (logo + navigation + déconnexion) affiché uniquement si connecté.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifierSession(token);

  return (
    <html lang="fr" className="h-full">
      <body className="flex min-h-full flex-col">
        {session ? (
          <header className="border-b bg-background">
            <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
              <Link href="/" className="mr-6 flex items-center">
                <Image
                  src="/logo-yvia.svg"
                  alt="Yvia"
                  width={107}
                  height={40}
                  className="h-7 w-auto"
                  priority
                />
              </Link>
              <NavLinks />
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {session.email}
                </span>
                <LogoutButton />
              </div>
            </nav>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
