"use server";
// Gestion des clés API de l'utilisateur connecté. Le middleware ne protège pas
// les Server Actions : chaque action revérifie la session.

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { getSession } from "@/lib/auth/server";
import { genererCleApi } from "@/lib/auth/api-key";

export type Resultat = { ok: boolean; message?: string };
// La clé en clair (`token`) n'est renvoyée qu'ici, une seule fois.
export type ResultatCreation = Resultat & { token?: string; nom?: string };

export async function creerCleApi(formData: FormData): Promise<ResultatCreation> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Donnez un nom à la clé (ex : « Claude Desktop »)." };
  if (nom.length > 80) return { ok: false, message: "Le nom est trop long (80 caractères maximum)." };

  const { token, tokenHash, prefixe } = genererCleApi();
  await db.insert(apiKeys).values({
    userId: session.userId,
    nom,
    prefixe,
    tokenHash,
    creeLe: new Date().toISOString(),
  });

  revalidatePath("/parametres");
  return { ok: true, token, nom };
}

export async function revoquerCleApi(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Clé introuvable." };

  // Un utilisateur ne peut révoquer que ses propres clés.
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId)));

  revalidatePath("/parametres");
  return { ok: true };
}
