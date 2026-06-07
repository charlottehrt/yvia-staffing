"use server";

import { db } from "@/db";
import { freelances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function ouNull(valeur: FormDataEntryValue | null): string | null {
  const texte = String(valeur ?? "").trim();
  return texte === "" ? null : texte;
}

export type Resultat = { ok: boolean; message?: string };

export async function creerFreelance(formData: FormData): Promise<Resultat> {
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!prenom || !nom) return { ok: false, message: "Le prénom et le nom sont obligatoires." };
  if (!email) return { ok: false, message: "L'email est obligatoire." };

  await db.insert(freelances).values({
    prenom,
    nom,
    email,
    notes: ouNull(formData.get("notes")),
    // actif = true par défaut (voir le schéma).
  });

  revalidatePath("/freelances");
  return { ok: true };
}

export async function modifierFreelance(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!id) return { ok: false, message: "Freelance introuvable." };
  if (!prenom || !nom) return { ok: false, message: "Le prénom et le nom sont obligatoires." };
  if (!email) return { ok: false, message: "L'email est obligatoire." };

  await db
    .update(freelances)
    .set({ prenom, nom, email, notes: ouNull(formData.get("notes")) })
    .where(eq(freelances.id, id));

  revalidatePath("/freelances");
  return { ok: true };
}

// Active ou désactive un freelance (pas de suppression : voir la spec).
export async function basculerActif(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Freelance introuvable." };

  await db.update(freelances).set({ actif: !actif }).where(eq(freelances.id, id));

  revalidatePath("/freelances");
  return { ok: true };
}
