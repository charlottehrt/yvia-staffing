"use server";

import { db } from "@/db";
import { missions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type Resultat = { ok: boolean; message?: string };

type ValeursMission = {
  freelanceId: number;
  clientId: number;
  nom: string;
  tjmAchat: string;
  tjmVente: string;
};

// Résultat de la lecture : soit une erreur, soit des valeurs valides.
type Lecture = { ok: false; erreur: string } | { ok: true; valeurs: ValeursMission };

// Vérifie et lit les champs d'une mission depuis le formulaire.
function lireChampsMission(formData: FormData): Lecture {
  const freelanceId = Number(formData.get("freelanceId"));
  const clientId = Number(formData.get("clientId"));
  const nom = String(formData.get("nom") ?? "").trim();
  const tjmAchat = String(formData.get("tjmAchat") ?? "").trim();
  const tjmVente = String(formData.get("tjmVente") ?? "").trim();

  if (!freelanceId || !clientId) {
    return { ok: false, erreur: "Le freelance et le client sont obligatoires." };
  }
  if (!nom) {
    return { ok: false, erreur: "Le nom de la mission est obligatoire." };
  }
  if (tjmAchat === "" || tjmVente === "") {
    return { ok: false, erreur: "Les TJM achat et vente sont obligatoires." };
  }
  if (Number(tjmVente) < Number(tjmAchat)) {
    return { ok: false, erreur: "Le TJM de vente doit être supérieur ou égal au TJM d'achat." };
  }
  return { ok: true, valeurs: { freelanceId, clientId, nom, tjmAchat, tjmVente } };
}

export async function creerMission(formData: FormData): Promise<Resultat> {
  const champs = lireChampsMission(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  await db.insert(missions).values(champs.valeurs);

  revalidatePath("/missions");
  return { ok: true };
}

export async function modifierMission(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Mission introuvable." };

  const champs = lireChampsMission(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  await db.update(missions).set(champs.valeurs).where(eq(missions.id, id));

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true };
}

// Active / désactive une mission (on ne supprime pas, pour garder l'historique).
// Une mission inactive n'est plus proposée dans le planning.
export async function basculerActifMission(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Mission introuvable." };

  await db.update(missions).set({ actif: !actif }).where(eq(missions.id, id));

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true };
}
