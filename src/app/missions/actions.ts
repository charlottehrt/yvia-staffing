"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { missions, affectations, clients } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";

export type MissionCree = {
  id: number;
  freelanceId: number;
  clientId: number;
  nom: string;
  clientNom: string;
  tjmAchat: string;
  tjmVente: string;
};
export type Resultat = { ok: false; message?: string } | { ok: true; mission?: MissionCree };

type ValeursMission = {
  freelanceId: number;
  clientId: number;
  nom: string;
  tjmAchat: string;
  tjmVente: string;
};

type Lecture = { ok: false; erreur: string } | { ok: true; valeurs: ValeursMission };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

function lireChampsMission(formData: FormData): Lecture {
  const freelanceId = Number(formData.get("freelanceId"));
  const clientId = Number(formData.get("clientId"));
  const nom = String(formData.get("nom") ?? "").trim();
  const tjmAchat = String(formData.get("tjmAchat") ?? "").trim();
  const tjmVente = String(formData.get("tjmVente") ?? "").trim();

  if (!freelanceId || !clientId) {
    return { ok: false, erreur: "Le freelance et le client sont obligatoires." };
  }
  if (!nom) return { ok: false, erreur: "Le nom de la mission est obligatoire." };
  if (tjmAchat === "" || tjmVente === "") {
    return { ok: false, erreur: "Les TJM achat et vente sont obligatoires." };
  }
  if (Number(tjmVente) < Number(tjmAchat)) {
    return { ok: false, erreur: "Le TJM de vente doit être supérieur ou égal au TJM d'achat." };
  }
  return { ok: true, valeurs: { freelanceId, clientId, nom, tjmAchat, tjmVente } };
}

export async function creerMission(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const champs = lireChampsMission(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  const [mission] = await db.insert(missions).values(champs.valeurs).returning({
    id: missions.id,
    freelanceId: missions.freelanceId,
    clientId: missions.clientId,
    nom: missions.nom,
    tjmAchat: missions.tjmAchat,
    tjmVente: missions.tjmVente,
  });
  const [client] = await db
    .select({ nom: clients.nom })
    .from(clients)
    .where(eq(clients.id, mission.clientId));

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true, mission: { ...mission, clientNom: client?.nom ?? "" } };
}

export async function modifierMission(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Mission introuvable." };

  const champs = lireChampsMission(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  await db.update(missions).set(champs.valeurs).where(eq(missions.id, id));

  const appliquerAuxJoursPoses =
    String(formData.get("appliquerAuxJoursPoses")) === "true";
  if (appliquerAuxJoursPoses) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    await db
      .update(affectations)
      .set({ tjmAchat: champs.valeurs.tjmAchat, tjmVente: champs.valeurs.tjmVente })
      .where(and(eq(affectations.missionId, id), gte(affectations.date, aujourdhui)));
  }

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true };
}

export async function basculerActifMission(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Mission introuvable." };

  await db.update(missions).set({ actif: !actif }).where(eq(missions.id, id));

  revalidatePath("/missions");
  revalidatePath("/");
  return { ok: true };
}
