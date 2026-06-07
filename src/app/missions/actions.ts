"use server";

import { db } from "@/db";
import { missions, tarifs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type Resultat = { ok: boolean; message?: string };

type ValeursMission = {
  freelanceId: number;
  clientId: number;
};

// Résultat de la lecture : soit une erreur, soit des valeurs valides.
type Lecture = { ok: false; erreur: string } | { ok: true; valeurs: ValeursMission };

// Vérifie et lit les champs communs d'une mission depuis le formulaire.
function lireChampsMission(formData: FormData): Lecture {
  const freelanceId = Number(formData.get("freelanceId"));
  const clientId = Number(formData.get("clientId"));

  if (!freelanceId || !clientId) {
    return { ok: false, erreur: "Le freelance et le client sont obligatoires." };
  }
  return { ok: true, valeurs: { freelanceId, clientId } };
}

export async function creerMission(formData: FormData): Promise<Resultat> {
  const champs = lireChampsMission(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  // Premier tarif (obligatoire à la création).
  const moisBrut = String(formData.get("moisEffet") ?? "").trim(); // "AAAA-MM"
  const tjmAchat = String(formData.get("tjmAchat") ?? "").trim();
  const tjmVente = String(formData.get("tjmVente") ?? "").trim();
  if (!moisBrut) return { ok: false, message: "Le mois d'effet du tarif est obligatoire." };
  if (tjmAchat === "" || tjmVente === "") {
    return { ok: false, message: "Les TJM achat et vente sont obligatoires." };
  }
  const moisEffet = `${moisBrut}-01`; // 1er du mois

  // Transaction : mission + premier tarif réussissent (ou échouent) ensemble.
  await db.transaction(async (tx) => {
    const [mission] = await tx
      .insert(missions)
      .values(champs.valeurs)
      .returning({ id: missions.id });
    await tx.insert(tarifs).values({ missionId: mission.id, moisEffet, tjmAchat, tjmVente });
  });

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
  return { ok: true };
}

export async function supprimerMission(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Mission introuvable." };

  // Les tarifs et absences liés sont supprimés automatiquement (cascade, voir le schéma).
  await db.delete(missions).where(eq(missions.id, id));

  revalidatePath("/missions");
  return { ok: true };
}

// Active / désactive la disponibilité d'une mission dans le planning.
export async function basculerDisponible(formData: FormData): Promise<Resultat> {
  const id = Number(formData.get("id"));
  const disponible = String(formData.get("disponible")) === "true";
  if (!id) return { ok: false, message: "Mission introuvable." };

  await db
    .update(missions)
    .set({ disponiblePlanning: !disponible })
    .where(eq(missions.id, id));

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true };
}
