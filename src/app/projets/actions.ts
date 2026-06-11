"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { projets, clients, encaissements, decaissements, jalons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { formatEuro } from "@/lib/format";
import { estFiabilite } from "@/lib/calculs/previsionnel";
import { getSession } from "@/lib/auth/server";

// Lit une catégorie de fiabilité depuis le formulaire : une vraie catégorie, ou null
// (valeur vide / sentinelle "herite" = on laisse la cascade décider).
function lireFiabilite(formData: FormData): string | null {
  const v = String(formData.get("fiabilite") ?? "").trim();
  return estFiabilite(v) ? v : null;
}

export type Resultat = { ok: boolean; message?: string };

function rafraichir() {
  revalidatePath("/projets");
  revalidatePath("/");
}

// Somme des encaissements déjà saisis pour un projet.
async function totalEncaisse(projetId: number): Promise<number> {
  const lignes = await db
    .select({ montant: encaissements.montant })
    .from(encaissements)
    .where(eq(encaissements.projetId, projetId));
  return lignes.reduce((s, l) => s + Number(l.montant), 0);
}

export async function creerProjet(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const clientId = Number(formData.get("clientId"));
  const nom = String(formData.get("nom") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();

  if (!clientId) return { ok: false, message: "Le client est obligatoire." };
  if (!nom) return { ok: false, message: "Le nom du projet est obligatoire." };
  if (budget === "" || Number(budget) <= 0) {
    return { ok: false, message: "Le budget doit être supérieur à 0." };
  }

  await db.insert(projets).values({ clientId, nom, budget });
  rafraichir();
  return { ok: true };
}

export async function modifierProjet(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  const clientId = Number(formData.get("clientId"));
  const nom = String(formData.get("nom") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();

  if (!id) return { ok: false, message: "Projet introuvable." };
  if (!clientId) return { ok: false, message: "Le client est obligatoire." };
  if (!nom) return { ok: false, message: "Le nom du projet est obligatoire." };
  if (budget === "" || Number(budget) <= 0) {
    return { ok: false, message: "Le budget doit être supérieur à 0." };
  }

  // Le budget ne peut pas passer sous le total déjà encaissé.
  const encaisse = await totalEncaisse(id);
  if (Number(budget) < encaisse) {
    return {
      ok: false,
      message: `Le budget ne peut pas être inférieur au total déjà encaissé (${formatEuro(encaisse)}).`,
    };
  }

  await db.update(projets).set({ clientId, nom, budget }).where(eq(projets.id, id));
  rafraichir();
  return { ok: true };
}

export async function basculerActifProjet(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Projet introuvable." };

  await db.update(projets).set({ actif: !actif }).where(eq(projets.id, id));
  rafraichir();
  return { ok: true };
}

export async function ajouterEncaissement(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const projetId = Number(formData.get("projetId"));
  const date = String(formData.get("date") ?? "").trim();
  const montant = String(formData.get("montant") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim() || null;
  // Statut : 'encaisse' (réalisé) par défaut, 'prevu' pour une échéance attendue.
  const statut = String(formData.get("statut")) === "prevu" ? "prevu" : "encaisse";
  // Fiabilité seulement pertinente pour une échéance prévue.
  const fiabilite = statut === "prevu" ? lireFiabilite(formData) : null;

  if (!projetId) return { ok: false, message: "Projet introuvable." };
  if (!date) return { ok: false, message: "La date est obligatoire." };
  if (montant === "" || Number(montant) <= 0) {
    return { ok: false, message: "Le montant doit être supérieur à 0." };
  }

  const [p] = await db.select({ budget: projets.budget }).from(projets).where(eq(projets.id, projetId));
  if (!p) return { ok: false, message: "Projet introuvable." };

  // Garde-fou : l'échéancier (prévu + encaissé) ne peut pas dépasser le budget.
  const planifie = await totalEncaisse(projetId);
  if (planifie + Number(montant) > Number(p.budget)) {
    const reste = Number(p.budget) - planifie;
    return {
      ok: false,
      message: `Cette échéance dépasse le budget du projet (reste à planifier : ${formatEuro(
        reste
      )}). Modifiez l'enveloppe budgétaire du projet pour pouvoir l'ajouter.`,
    };
  }

  await db.insert(encaissements).values({ projetId, date, montant, libelle, statut, fiabilite });
  rafraichir();
  return { ok: true };
}

export async function supprimerEncaissement(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Encaissement introuvable." };
  await db.delete(encaissements).where(eq(encaissements.id, id));
  rafraichir();
  return { ok: true };
}

export async function ajouterDecaissement(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const projetId = Number(formData.get("projetId"));
  const freelanceId = Number(formData.get("freelanceId"));
  const date = String(formData.get("date") ?? "").trim();
  const montant = String(formData.get("montant") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim() || null;

  // Statut : 'decaisse' (réalisé) par défaut, 'prevu' pour un coût à venir.
  const statut = String(formData.get("statut")) === "prevu" ? "prevu" : "decaisse";

  if (!projetId) return { ok: false, message: "Projet introuvable." };
  if (!freelanceId) return { ok: false, message: "Le freelance est obligatoire." };
  if (!date) return { ok: false, message: "La date est obligatoire." };
  if (montant === "" || Number(montant) <= 0) {
    return { ok: false, message: "Le montant doit être supérieur à 0." };
  }

  const [p] = await db.select({ budget: projets.budget }).from(projets).where(eq(projets.id, projetId));
  if (!p) return { ok: false, message: "Projet introuvable." };
  if (Number(montant) > Number(p.budget)) {
    return {
      ok: false,
      message: `Le montant dépasse le budget du projet (${formatEuro(Number(p.budget))}).`,
    };
  }

  await db.insert(decaissements).values({ projetId, freelanceId, date, montant, libelle, statut });
  rafraichir();
  return { ok: true };
}

export async function supprimerDecaissement(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Décaissement introuvable." };
  await db.delete(decaissements).where(eq(decaissements.id, id));
  rafraichir();
  return { ok: true };
}

// Bascule une échéance de recette prévue en réalisée (encaissée).
export async function marquerEncaissementRealise(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Échéance introuvable." };
  await db.update(encaissements).set({ statut: "encaisse" }).where(eq(encaissements.id, id));
  rafraichir();
  return { ok: true };
}

// Bascule une échéance de coût prévue en réalisée (décaissée).
export async function marquerDecaissementRealise(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Échéance introuvable." };
  await db.update(decaissements).set({ statut: "decaisse" }).where(eq(decaissements.id, id));
  rafraichir();
  return { ok: true };
}

// Fiabilité de paiement par défaut d'un client (vide = aucune).
export async function definirFiabiliteClient(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const clientId = Number(formData.get("clientId"));
  if (!clientId) return { ok: false, message: "Client introuvable." };
  await db
    .update(clients)
    .set({ fiabiliteDefaut: lireFiabilite(formData) })
    .where(eq(clients.id, clientId));
  rafraichir();
  return { ok: true };
}

// Fiabilité par défaut d'un projet (vide = hérite du client).
export async function definirFiabiliteProjet(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const projetId = Number(formData.get("projetId"));
  if (!projetId) return { ok: false, message: "Projet introuvable." };
  await db
    .update(projets)
    .set({ fiabiliteDefaut: lireFiabilite(formData) })
    .where(eq(projets.id, projetId));
  rafraichir();
  return { ok: true };
}

// --- JALONS : repères datés, sans montant. N'impactent pas la marge. ---
export async function ajouterJalon(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const projetId = Number(formData.get("projetId"));
  const date = String(formData.get("date") ?? "").trim();
  const libelle = String(formData.get("libelle") ?? "").trim();

  if (!projetId) return { ok: false, message: "Projet introuvable." };
  if (!date) return { ok: false, message: "La date est obligatoire." };
  if (!libelle) return { ok: false, message: "Le libellé du jalon est obligatoire." };

  await db.insert(jalons).values({ projetId, date, libelle });
  rafraichir();
  return { ok: true };
}

export async function supprimerJalon(formData: FormData): Promise<Resultat> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Vous n'êtes pas connecté." };

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Jalon introuvable." };
  await db.delete(jalons).where(eq(jalons.id, id));
  rafraichir();
  return { ok: true };
}
