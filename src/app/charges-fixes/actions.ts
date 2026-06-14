"use server";
// Le middleware ne protège PAS les Server Actions : chaque mutation vérifie la session.

import { db } from "@/db";
import { chargesFixes, chargesFixesValeurs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";

export type Resultat = { ok: false; message?: string } | { ok: true };

type ValeursCharge = {
  libelle: string;
  montantMensuel: string;
  dateDebut: string; // "AAAA-MM-JJ" (1er du mois)
  dateFin: string | null; // "AAAA-MM-JJ" (1er du mois) | null
};

type Lecture = { ok: false; erreur: string } | { ok: true; valeurs: ValeursCharge };

async function verifierConnecte(): Promise<Resultat> {
  if (await getSession()) return { ok: true };
  return { ok: false, message: "Vous n'êtes pas connecté." };
}

const FORMAT_MOIS = /^\d{4}-\d{2}$/;

// Normalise une valeur de champ mois ("AAAA-MM" ou "AAAA-MM-JJ") vers le 1er du
// mois ("AAAA-MM-01"). Renvoie null si le format est invalide ou vide.
function normaliserMois(valeur: string): string | null {
  const mois = valeur.trim().slice(0, 7);
  if (!FORMAT_MOIS.test(mois)) return null;
  return `${mois}-01`;
}

function lireChampsCharge(formData: FormData): Lecture {
  const libelle = String(formData.get("libelle") ?? "").trim();
  const montantMensuel = String(formData.get("montantMensuel") ?? "").trim();
  const dateDebut = normaliserMois(String(formData.get("dateDebut") ?? ""));
  const dateFinBrute = String(formData.get("dateFin") ?? "").trim();
  const dateFin = dateFinBrute ? normaliserMois(dateFinBrute) : null;

  if (!libelle) return { ok: false, erreur: "Le libellé est obligatoire." };
  if (montantMensuel === "" || !Number.isFinite(Number(montantMensuel)) || Number(montantMensuel) < 0) {
    return { ok: false, erreur: "Le montant mensuel doit être un nombre positif." };
  }
  if (!dateDebut) return { ok: false, erreur: "Le mois de début est obligatoire." };
  if (dateFinBrute && !dateFin) return { ok: false, erreur: "Le mois de fin est invalide." };
  if (dateFin && dateFin < dateDebut) {
    return { ok: false, erreur: "Le mois de fin doit être après le mois de début." };
  }

  return { ok: true, valeurs: { libelle, montantMensuel, dateDebut, dateFin } };
}

export async function creerChargeFixe(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const champs = lireChampsCharge(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  await db.insert(chargesFixes).values(champs.valeurs);

  revalidatePath("/charges-fixes");
  return { ok: true };
}

export async function modifierChargeFixe(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Charge introuvable." };

  const champs = lireChampsCharge(formData);
  if (!champs.ok) return { ok: false, message: champs.erreur };

  await db.update(chargesFixes).set(champs.valeurs).where(eq(chargesFixes.id, id));

  revalidatePath("/charges-fixes");
  return { ok: true };
}

export async function basculerActifChargeFixe(formData: FormData): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  if (!id) return { ok: false, message: "Charge introuvable." };

  await db.update(chargesFixes).set({ actif: !actif }).where(eq(chargesFixes.id, id));

  revalidatePath("/charges-fixes");
  return { ok: true };
}

// Enregistre (ou efface) le montant ponctuel d'une charge pour un mois donné.
// montant vide/null  -> on supprime l'ajustement : le mois retombe sur le montant récurrent.
// montant renseigné  -> on enregistre l'ajustement (0 inclus = mois non payé).
export async function enregistrerValeurChargeFixe(
  chargeFixeId: number,
  mois: string,
  montant: string | null
): Promise<Resultat> {
  const session = await verifierConnecte();
  if (!session.ok) return session;

  if (!chargeFixeId) return { ok: false, message: "Charge introuvable." };
  if (!FORMAT_MOIS.test(mois)) return { ok: false, message: "Mois invalide." };

  const brut = montant?.trim() ?? "";

  if (brut === "") {
    await db
      .delete(chargesFixesValeurs)
      .where(
        and(
          eq(chargesFixesValeurs.chargeFixeId, chargeFixeId),
          eq(chargesFixesValeurs.mois, mois)
        )
      );
    revalidatePath("/charges-fixes");
    return { ok: true };
  }

  if (!Number.isFinite(Number(brut)) || Number(brut) < 0) {
    return { ok: false, message: "Le montant doit être un nombre positif." };
  }

  await db
    .insert(chargesFixesValeurs)
    .values({ chargeFixeId, mois, montant: brut })
    .onConflictDoUpdate({
      target: [chargesFixesValeurs.chargeFixeId, chargesFixesValeurs.mois],
      set: { montant: brut },
    });

  revalidatePath("/charges-fixes");
  return { ok: true };
}
