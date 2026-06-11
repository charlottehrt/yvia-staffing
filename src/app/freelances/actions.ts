"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { freelances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";

export type Resultat = { ok: boolean; message?: string };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

export async function creerFreelance(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!prenom || !nom) return { ok: false, message: "Le prénom et le nom sont obligatoires." };

  await db.insert(freelances).values({ prenom, nom });

  revalidatePath("/freelances");
  return { ok: true };
}

export async function modifierFreelance(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!id) return { ok: false, message: "Freelance introuvable." };
  if (!prenom || !nom) return { ok: false, message: "Le prénom et le nom sont obligatoires." };

  await db.update(freelances).set({ prenom, nom }).where(eq(freelances.id, id));

  revalidatePath("/freelances");
  return { ok: true };
}

export async function basculerActif(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Freelance introuvable." };

  await db.update(freelances).set({ actif: !actif }).where(eq(freelances.id, id));

  revalidatePath("/freelances");
  return { ok: true };
}
