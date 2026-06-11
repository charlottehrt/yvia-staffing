"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { affectations, missions } from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  premierJourDuMois,
  dernierJourDuMois,
  listeJoursOuvresDuMois,
} from "@/lib/calculs/jours-ouvres";
import { getSession } from "@/lib/auth/server";

export type Resultat = { ok: boolean; message?: string };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

// Affecte une liste de jours (AAAA-MM-JJ) d'un freelance à une mission.
// Tout jour déjà affecté pour ce freelance est réécrit (1 mission par jour max).
export async function affecterJours(
  missionId: number,
  freelanceId: number,
  dates: string[]
): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  if (!missionId || !freelanceId || dates.length === 0) {
    return { ok: false, message: "Données manquantes." };
  }

  // Sécurité : la mission doit bien appartenir à ce freelance.
  // On récupère aussi le TJM courant pour le figer sur chaque jour d'affectation.
  const [m] = await db
    .select({
      freelanceId: missions.freelanceId,
      tjmAchat: missions.tjmAchat,
      tjmVente: missions.tjmVente,
    })
    .from(missions)
    .where(eq(missions.id, missionId));
  if (!m || m.freelanceId !== freelanceId) {
    return { ok: false, message: "Cette mission ne correspond pas au freelance." };
  }

  await db.transaction(async (tx) => {
    // On efface d'abord toute affectation existante de ce freelance sur ces jours...
    await tx
      .delete(affectations)
      .where(
        and(eq(affectations.freelanceId, freelanceId), inArray(affectations.date, dates))
      );
    // ...puis on insère la nouvelle affectation, avec le TJM recopié de la mission.
    await tx.insert(affectations).values(
      dates.map((date) => ({
        missionId,
        freelanceId,
        date,
        tjmAchat: m.tjmAchat,
        tjmVente: m.tjmVente,
      }))
    );
  });

  revalidatePath("/");
  return { ok: true };
}

// Étend le planning d'un mois sur le mois suivant : on recopie chaque affectation
// sur le jour ouvré de même rang dans le mois suivant (1er jour ouvré -> 1er, etc.),
// en gardant la mission et le TJM figé. Les jours cibles déjà posés sont remplacés.
export async function etendreAuMoisSuivant(
  annee: number,
  mois: number
): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const suivant = mois === 12 ? { a: annee + 1, m: 1 } : { a: annee, m: mois + 1 };

  const joursSource = listeJoursOuvresDuMois(annee, mois);
  const joursCible = listeJoursOuvresDuMois(suivant.a, suivant.m);
  const rangDe = new Map(joursSource.map((d, i) => [d, i]));

  // Affectations du mois source.
  const affsSource = await db
    .select({
      freelanceId: affectations.freelanceId,
      missionId: affectations.missionId,
      date: affectations.date,
      tjmAchat: affectations.tjmAchat,
      tjmVente: affectations.tjmVente,
    })
    .from(affectations)
    .where(
      and(
        gte(affectations.date, premierJourDuMois(annee, mois)),
        lte(affectations.date, dernierJourDuMois(annee, mois))
      )
    );

  // On ne recopie que les jours ouvrés (les week-ends/fériés posés sont ignorés).
  const nouvelles = affsSource
    .map((a) => {
      const rang = rangDe.get(a.date);
      if (rang === undefined) return null;
      const cible = joursCible[rang];
      if (!cible) return null; // pas assez de jours ouvrés le mois suivant
      return {
        freelanceId: a.freelanceId,
        missionId: a.missionId,
        date: cible,
        tjmAchat: a.tjmAchat,
        tjmVente: a.tjmVente,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (nouvelles.length === 0) {
    return { ok: false, message: "Aucun jour ouvré à étendre sur le mois suivant." };
  }

  // Jours cibles par freelance, pour remplacer proprement l'existant (unicité freelance+jour).
  const ciblesParFreelance = new Map<number, string[]>();
  for (const n of nouvelles) {
    const arr = ciblesParFreelance.get(n.freelanceId) ?? [];
    arr.push(n.date);
    ciblesParFreelance.set(n.freelanceId, arr);
  }

  await db.transaction(async (tx) => {
    for (const [freelanceId, dates] of ciblesParFreelance) {
      await tx
        .delete(affectations)
        .where(
          and(eq(affectations.freelanceId, freelanceId), inArray(affectations.date, dates))
        );
    }
    await tx.insert(affectations).values(nouvelles);
  });

  revalidatePath("/");
  return { ok: true };
}

// Modifie le TJM (achat et/ou vente) d'un seul jour déjà posé.
// L'affectation est unique par (freelance, date), donc on ne touche que cette case.
export async function modifierTjmAffectation(
  freelanceId: number,
  date: string,
  tjmAchat: string,
  tjmVente: string
): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  if (!freelanceId || !date) return { ok: false, message: "Données manquantes." };
  if (tjmAchat.trim() === "" || tjmVente.trim() === "") {
    return { ok: false, message: "Les TJM achat et vente sont obligatoires." };
  }
  if (Number(tjmVente) < Number(tjmAchat)) {
    return {
      ok: false,
      message: "Le TJM de vente doit être supérieur ou égal au TJM d'achat.",
    };
  }

  await db
    .update(affectations)
    .set({ tjmAchat, tjmVente })
    .where(and(eq(affectations.freelanceId, freelanceId), eq(affectations.date, date)));

  revalidatePath("/");
  return { ok: true };
}

// Libère (vide) une liste de jours pour un freelance.
export async function libererJours(
  freelanceId: number,
  dates: string[]
): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  if (!freelanceId || dates.length === 0) {
    return { ok: false, message: "Données manquantes." };
  }
  await db
    .delete(affectations)
    .where(
      and(eq(affectations.freelanceId, freelanceId), inArray(affectations.date, dates))
    );
  revalidatePath("/");
  return { ok: true };
}
