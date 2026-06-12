import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/cal-sans/400.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./sidebar";
import { DrawerProvider } from "./_drawer/drawer-stack";
import { EnregistrementServiceWorker } from "@/components/enregistrement-service-worker";
import { estAdmin } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Yvia - Dashboard",
  description: "Pilotage de la marge des freelances en mission",
  applicationName: "Yvia",
  // Installation sur iOS : icône et mode plein écran via les balises Apple.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yvia",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // En-tête (logo + navigation + déconnexion) affiché uniquement si connecté.
  const session = await getSession();
  const nomAffiche = [session?.prenom, session?.nom].filter(Boolean).join(" ") || session?.email || "";

  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">
        {session ? (
          <DrawerProvider>
            {/* Colonne sur mobile (barre en haut), ligne sur desktop (sidebar à gauche). */}
            <div className="flex min-h-screen flex-col lg:flex-row">
              <Sidebar nomAffiche={nomAffiche} admin={estAdmin(session)} />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
                {children}
              </main>
            </div>
          </DrawerProvider>
        ) : (
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        )}
        <Toaster />
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
