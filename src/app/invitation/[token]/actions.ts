"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, invitations } from "@/db/schema";
import { hasherMotDePasse } from "@/lib/auth/password";
import { signerSession, pvDepuisHash, SESSION_COOKIE, DUREE_SESSION_MS } from "@/lib/auth/session";
import { reinitialiserLimite, verifierLimite } from "@/lib/auth/rate-limit";

export type Resultat = { ok: boolean; message?: string };

export async function accepterInvitation(formData: FormData): Promise<Resultat> {
  const token = String(formData.get("token") ?? "");
  const prenom = String(formData.get("prenom") ?? "").trim() || null;
  const nom = String(formData.get("nom") ?? "").trim() || null;
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const limite = await verifierLimite("invitation-accept", token, 5, 10 * 60 * 1000);
  if (!limite.ok) return limite;

  const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
  if (!inv || inv.utilisee || new Date(inv.expireLe) <= new Date()) {
    return { ok: false, message: "Invitation invalide ou expirée." };
  }
  if (motDePasse.length < 8) {
    return { ok: false, message: "Le mot de passe doit faire au moins 8 caractères." };
  }
  if (motDePasse !== confirmation) {
    return { ok: false, message: "La confirmation ne correspond pas." };
  }

  const [existant] = await db.select().from(users).where(eq(users.email, inv.email));
  if (existant) return { ok: false, message: "Un compte existe déjà pour cet email." };

  const passwordHash = hasherMotDePasse(motDePasse);
  const role = inv.role === "admin" ? "admin" : "user";
  const [u] = await db
    .insert(users)
    .values({
      email: inv.email,
      passwordHash,
      prenom: prenom ?? inv.prenom,
      nom: nom ?? inv.nom,
      role,
    })
    .returning({ id: users.id, email: users.email });
  await db.update(invitations).set({ utilisee: true }).where(eq(invitations.id, inv.id));

  // Connexion automatique après création du compte.
  const exp = Date.now() + DUREE_SESSION_MS;
  const pv = await pvDepuisHash(passwordHash);
  const sessToken = await signerSession({ userId: u.id, email: u.email, exp, pv, role });
  (await cookies()).set(SESSION_COOKIE, sessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
  await reinitialiserLimite("invitation-accept", token);
  return { ok: true };
}
