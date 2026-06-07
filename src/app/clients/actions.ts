"use server";
// "use server" : ces fonctions s'exécutent UNIQUEMENT sur le serveur.
// L'écran les appelle, mais le code (et l'accès à la base) reste côté serveur.

import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type Resultat = { ok: boolean; message?: string };

export async function creerClient(formData: FormData): Promise<Resultat> {
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Le nom de la société est obligatoire." };

  await db.insert(clients).values({ nom });

  // On indique à Next que la page /clients a changé : elle sera rafraîchie.
  revalidatePath("/clients");
  return { ok: true };
}

export async function modifierClient(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const nom = String(formData.get("nom") ?? "").trim();
  if (!id) return { ok: false, message: "Client introuvable." };
  if (!nom) return { ok: false, message: "Le nom de la société est obligatoire." };

  await db.update(clients).set({ nom }).where(eq(clients.id, id));

  revalidatePath("/clients");
  return { ok: true };
}

// Archive / désarchive un client (on ne supprime pas, pour garder l'historique).
export async function basculerActifClient(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Client introuvable." };

  await db.update(clients).set({ actif: !actif }).where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true };
}
