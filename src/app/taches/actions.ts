"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { taches, commentairesTache } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";

export type TacheCree = { id: number; nom: string };
export type Resultat = { ok: false; message?: string } | { ok: true; tache?: TacheCree };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

// --- TÂCHES ---

export async function creerTache(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Le nom de la tâche est obligatoire." };

  const [tache] = await db
    .insert(taches)
    .values({ nom, creeLe: new Date().toISOString() })
    .returning({ id: taches.id, nom: taches.nom });
  revalidatePath("/taches");
  return { ok: true, tache };
}

export async function renommerTache(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const nom = String(formData.get("nom") ?? "").trim();
  if (!id) return { ok: false, message: "Tâche introuvable." };
  if (!nom) return { ok: false, message: "Le nom de la tâche est obligatoire." };

  await db.update(taches).set({ nom }).where(eq(taches.id, id));
  revalidatePath("/taches");
  return { ok: true };
}

export async function basculerTermineTache(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const termine = String(formData.get("termine")) === "true";
  if (!id) return { ok: false, message: "Tâche introuvable." };

  await db.update(taches).set({ termine: !termine }).where(eq(taches.id, id));
  revalidatePath("/taches");
  return { ok: true };
}

export async function supprimerTache(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Tâche introuvable." };

  // Les commentaires partent en cascade (cf. schéma).
  await db.delete(taches).where(eq(taches.id, id));
  revalidatePath("/taches");
  return { ok: true };
}

// --- COMMENTAIRES DE SUIVI ---

export async function ajouterCommentaire(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const tacheId = Number(formData.get("tacheId"));
  const contenu = String(formData.get("contenu") ?? "").trim();
  if (!tacheId) return { ok: false, message: "Tâche introuvable." };
  if (!contenu) return { ok: false, message: "Le commentaire est vide." };

  await db
    .insert(commentairesTache)
    .values({ tacheId, contenu, creeLe: new Date().toISOString() });
  revalidatePath("/taches");
  return { ok: true };
}

export async function supprimerCommentaire(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Commentaire introuvable." };

  await db.delete(commentairesTache).where(eq(commentairesTache.id, id));
  revalidatePath("/taches");
  return { ok: true };
}
