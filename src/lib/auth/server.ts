// Helpers d'authentification réservés au serveur (utilisent next/headers et la
// base). Ne pas importer dans le proxy Next.js ni côté client.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifierSession, pvDepuisHash, SESSION_COOKIE, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifierSession(token);
  if (!session) return null;

  // Révocation : on compare l'ancre du jeton (pv) au hash du mot de passe
  // courant. S'ils divergent (mot de passe changé, compte recréé) ou si le
  // compte n'existe plus, le jeton est considéré comme révoqué.
  const [u] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!u || (await pvDepuisHash(u.passwordHash)) !== session.pv) return null;

  return {
    userId: u.id,
    email: u.email,
    exp: session.exp,
    pv: session.pv,
    role: u.role === "user" ? "user" : "admin",
  };
}

// À appeler en tête des pages protégées : renvoie la session ou redirige vers
// /login. Centralise le contrôle d'accès des Server Components qui lisent des
// données (le proxy ne fait qu'un filtrage optimiste, sans accès base).
export async function exigerSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
