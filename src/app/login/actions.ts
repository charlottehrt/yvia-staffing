"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifierMotDePasse } from "@/lib/auth/password";
import { signerSession, pvDepuisHash, SESSION_COOKIE, DUREE_SESSION_MS } from "@/lib/auth/session";
import { reinitialiserLimite, verifierLimite } from "@/lib/auth/rate-limit";

export type Resultat = { ok: boolean; message?: string };

export async function connexion(formData: FormData): Promise<Resultat> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  if (!email || !motDePasse) {
    return { ok: false, message: "Email et mot de passe requis." };
  }

  const limite = await verifierLimite("login", email, 5, 10 * 60 * 1000);
  if (!limite.ok) return limite;

  const [u] = await db.select().from(users).where(eq(users.email, email));
  // Message volontairement générique (on ne révèle pas si l'email existe).
  if (!u || !verifierMotDePasse(motDePasse, u.passwordHash)) {
    return { ok: false, message: "Identifiants incorrects." };
  }

  const exp = Date.now() + DUREE_SESSION_MS;
  const pv = await pvDepuisHash(u.passwordHash);
  const role = u.role === "user" ? "user" : "admin";
  const token = await signerSession({ userId: u.id, email: u.email, exp, pv, role });
  await reinitialiserLimite("login", email);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
  redirect("/");
}

export async function deconnexion(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
