"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";

export type Resultat = { ok: boolean; message?: string };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

export async function creerClient(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Le nom de la société est obligatoire." };

  await db.insert(clients).values({ nom });
  revalidatePath("/clients");
  return { ok: true };
}

export async function modifierClient(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const nom = String(formData.get("nom") ?? "").trim();
  if (!id) return { ok: false, message: "Client introuvable." };
  if (!nom) return { ok: false, message: "Le nom de la société est obligatoire." };

  await db.update(clients).set({ nom }).where(eq(clients.id, id));

  revalidatePath("/clients");
  return { ok: true };
}

export async function basculerActifClient(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Client introuvable." };

  await db.update(clients).set({ actif: !actif }).where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true };
}
