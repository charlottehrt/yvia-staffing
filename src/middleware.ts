import { NextResponse, type NextRequest } from "next/server";
import { verifierSession, SESSION_COOKIE } from "@/lib/auth/session";

// Protège toute l'application : sans session valide, on redirige vers /login.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifierSession(token);
  const surLogin = req.nextUrl.pathname === "/login";

  if (!session && !surLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Déjà connecté et sur /login : on renvoie vers l'accueil.
  if (session && surLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// On exclut les assets statiques et le dossier _next.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
