import { NextResponse, type NextRequest } from "next/server";
import { verifierSession, SESSION_COOKIE } from "@/lib/auth/session";

// Protège toute l'application : sans session valide, on redirige vers /login.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifierSession(token);
  const { pathname } = req.nextUrl;
  // Pages accessibles sans être connecté : connexion et acceptation d'invitation.
  const estPublique = pathname === "/login" || pathname.startsWith("/invitation/");

  if (!session && !estPublique) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Ne pas rediriger /login vers / depuis le proxy : ici on ne vérifie que la
  // signature du cookie, pas sa révocation en base (mot de passe changé, seed de
  // preview, compte recréé). Un vieux cookie signé peut donc être refusé ensuite
  // par getSession(); le laisser accéder à /login évite une boucle / ↔ /login.
  return NextResponse.next();
}

// On exclut les assets statiques, le dossier _next et les fichiers PWA
// (manifest, service worker, page hors-ligne, icônes) qui doivent rester
// accessibles sans session.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.svg).*)",
  ],
};
