"use server";
// Chargement à la demande du détail d'une entité pour les drawers en cascade,
// édition inline d'un champ, et bascule actif/inactif (bouton au bas du drawer).

import { and, eq, gte, lte, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  freelances,
  clients,
  missions,
  projets,
  users,
  affectations,
  encaissements,
  decaissements,
} from "@/db/schema";
import { getSession } from "@/lib/auth/server";
import { estAdmin } from "@/lib/auth/session";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import { calculMissionRealisee } from "@/lib/calculs/marge";
import { formatEuro, formatJours } from "@/lib/format";
import { labelStatutCommercial, normaliserStatutCommercial } from "@/lib/projets/statut-commercial";
import type { DetailEntite, EntiteRef } from "./types";

const arrondi = (n: number) => Math.round(n * 100) / 100;
// Montant sans décimales (les TJM/budgets sont saisis en euros entiers).
const entier = (v: string) => String(Math.round(Number(v)));

function moisCourant() {
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;
  return { debut: premierJourDuMois(annee, mois), fin: dernierJourDuMois(annee, mois) };
}

export async function chargerEntite(ref: EntiteRef): Promise<DetailEntite | null> {
  const session = await getSession();
  if (!session) return null;

  switch (ref.type) {
    case "freelance":
      return chargerFreelance(ref.id);
    case "client":
      return chargerClient(ref.id);
    case "mission":
      return chargerMission(ref.id);
    case "projet":
      return chargerProjet(ref.id);
    case "user":
      if (!estAdmin(session)) return null;
      return chargerUser(ref.id);
    default:
      return null;
  }
}

async function chargerUser(id: number): Promise<DetailEntite | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return null;

  const nomComplet = [u.prenom, u.nom].filter(Boolean).join(" ");

  return {
    ref: { type: "user", id },
    titre: nomComplet || u.email,
    sousTitre: u.email,
    actif: true,
    actionLabel: "",
    champs: [
      { cle: "prenom", label: "Prénom", valeur: u.prenom ?? "", type: "text" },
      { cle: "nom", label: "Nom", valeur: u.nom ?? "", type: "text" },
    ],
    infos: [
      { label: "Email", valeur: u.email },
      { label: "Rôle", valeur: u.role === "user" ? "Utilisateur" : "Administrateur" },
    ],
    sections: [],
  };
}

async function chargerFreelance(id: number): Promise<DetailEntite | null> {
  const [f] = await db.select().from(freelances).where(eq(freelances.id, id));
  if (!f) return null;

  const missionsRows = await db
    .select({
      id: missions.id,
      nom: missions.nom,
      actif: missions.actif,
      clientNom: clients.nom,
      tjmAchat: missions.tjmAchat,
      tjmVente: missions.tjmVente,
    })
    .from(missions)
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .where(eq(missions.freelanceId, id))
    .orderBy(missions.nom);

  const { debut, fin } = moisCourant();
  const affs = await db
    .select({ tjmAchat: affectations.tjmAchat, tjmVente: affectations.tjmVente })
    .from(affectations)
    .where(
      and(eq(affectations.freelanceId, id), gte(affectations.date, debut), lte(affectations.date, fin))
    );
  const jours = affs.length;
  const marge = arrondi(affs.reduce((s, a) => s + (Number(a.tjmVente) - Number(a.tjmAchat)), 0));

  return {
    ref: { type: "freelance", id },
    titre: `${f.prenom} ${f.nom}`,
    sousTitre: f.actif ? "Freelance actif" : "Freelance archivé",
    actif: f.actif,
    actionLabel: "Archiver",
    champs: [
      { cle: "prenom", label: "Prénom", valeur: f.prenom, type: "text" },
      { cle: "nom", label: "Nom", valeur: f.nom, type: "text" },
    ],
    infos: [
      { label: "Jours posés ce mois", valeur: formatJours(jours) },
      { label: "Marge ce mois", valeur: formatEuro(marge) },
    ],
    sections: [
      {
        titre: "Missions",
        vide: "Aucune mission (intercontrat).",
        liens: missionsRows.map((m) => ({
          ref: { type: "mission", id: m.id },
          label: m.actif ? m.nom : `${m.nom} (inactive)`,
          sous: `${m.clientNom} · ${formatEuro(Number(m.tjmVente) - Number(m.tjmAchat))}/j`,
        })),
      },
    ],
  };
}

async function chargerClient(id: number): Promise<DetailEntite | null> {
  const [c] = await db.select().from(clients).where(eq(clients.id, id));
  if (!c) return null;

  const missionsRows = await db
    .select({
      id: missions.id,
      nom: missions.nom,
      actif: missions.actif,
      freelancePrenom: freelances.prenom,
      freelanceNom: freelances.nom,
    })
    .from(missions)
    .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
    .where(eq(missions.clientId, id))
    .orderBy(missions.nom);

  const projetsRows = await db
    .select({ id: projets.id, nom: projets.nom, actif: projets.actif, budget: projets.budget })
    .from(projets)
    .where(and(eq(projets.clientId, id), eq(projets.actif, true), ne(projets.statutCommercial, "perdu")))
    .orderBy(projets.nom);

  const { debut, fin } = moisCourant();
  const affs = await db
    .select({ tjmVente: affectations.tjmVente })
    .from(affectations)
    .innerJoin(missions, eq(affectations.missionId, missions.id))
    .where(and(eq(missions.clientId, id), gte(affectations.date, debut), lte(affectations.date, fin)));
  const jours = affs.length;
  const ca = arrondi(affs.reduce((s, a) => s + Number(a.tjmVente), 0));

  return {
    ref: { type: "client", id },
    titre: c.nom,
    sousTitre: c.actif ? "Client actif" : "Client archivé",
    actif: c.actif,
    actionLabel: "Archiver",
    champs: [{ cle: "nom", label: "Nom de la société", valeur: c.nom, type: "text" }],
    infos: [
      { label: "Jours facturés ce mois", valeur: formatJours(jours) },
      { label: "CA régie ce mois", valeur: formatEuro(ca) },
    ],
    sections: [
      {
        titre: "Missions",
        vide: "Aucune mission chez ce client.",
        liens: missionsRows.map((m) => ({
          ref: { type: "mission", id: m.id },
          label: m.actif ? m.nom : `${m.nom} (inactive)`,
          sous: `${m.freelancePrenom} ${m.freelanceNom}`,
        })),
      },
      {
        titre: "Projets",
        vide: "Aucun projet pour ce client.",
        liens: projetsRows.map((p) => ({
          ref: { type: "projet", id: p.id },
          label: p.actif ? p.nom : `${p.nom} (archivé)`,
          sous: formatEuro(Number(p.budget)),
        })),
      },
    ],
  };
}

async function chargerMission(id: number): Promise<DetailEntite | null> {
  const [m] = await db
    .select({
      id: missions.id,
      nom: missions.nom,
      actif: missions.actif,
      tjmAchat: missions.tjmAchat,
      tjmVente: missions.tjmVente,
      freelanceId: missions.freelanceId,
      freelancePrenom: freelances.prenom,
      freelanceNom: freelances.nom,
      clientId: missions.clientId,
      clientNom: clients.nom,
    })
    .from(missions)
    .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
    .innerJoin(clients, eq(missions.clientId, clients.id))
    .where(eq(missions.id, id));
  if (!m) return null;

  const affectationsMission = await db
    .select({ tjmAchat: affectations.tjmAchat, tjmVente: affectations.tjmVente })
    .from(affectations)
    .where(eq(affectations.missionId, id));

  const margeJour = Number(m.tjmVente) - Number(m.tjmAchat);
  const realise = calculMissionRealisee(affectationsMission);

  return {
    ref: { type: "mission", id },
    titre: m.nom,
    sousTitre: m.actif ? "Mission active" : "Mission inactive",
    actif: m.actif,
    actionLabel: "Désactiver",
    champs: [
      { cle: "nom", label: "Nom de la mission", valeur: m.nom, type: "text" },
      { cle: "tjmAchat", label: "TJM achat (€)", valeur: entier(m.tjmAchat), type: "number" },
      { cle: "tjmVente", label: "TJM vente (€)", valeur: entier(m.tjmVente), type: "number" },
    ],
    infos: [
      { label: "Jours facturés", valeur: formatJours(realise.joursFactures) },
      { label: "CA généré", valeur: formatEuro(realise.ca) },
      { label: "Marge depuis le début", valeur: formatEuro(realise.marge) },
      { label: "Marge / jour", valeur: formatEuro(margeJour) },
      { label: "Statut", valeur: m.actif ? "Active" : "Inactive" },
    ],
    sections: [
      {
        titre: "Freelance",
        vide: "",
        liens: [
          {
            ref: { type: "freelance", id: m.freelanceId },
            label: `${m.freelancePrenom} ${m.freelanceNom}`,
          },
        ],
      },
      {
        titre: "Client",
        vide: "",
        liens: [{ ref: { type: "client", id: m.clientId }, label: m.clientNom }],
      },
    ],
  };
}

async function chargerProjet(id: number): Promise<DetailEntite | null> {
  const [p] = await db
    .select({
      id: projets.id,
      nom: projets.nom,
      actif: projets.actif,
      budget: projets.budget,
      clientId: projets.clientId,
      clientNom: clients.nom,
      statutCommercial: projets.statutCommercial,
    })
    .from(projets)
    .innerJoin(clients, eq(projets.clientId, clients.id))
    .where(eq(projets.id, id));
  if (!p) return null;

  const encs = await db
    .select({ montant: encaissements.montant, statut: encaissements.statut })
    .from(encaissements)
    .where(eq(encaissements.projetId, id));
  const decs = await db
    .select({
      montant: decaissements.montant,
      statut: decaissements.statut,
      freelanceId: decaissements.freelanceId,
      freelancePrenom: freelances.prenom,
      freelanceNom: freelances.nom,
    })
    .from(decaissements)
    .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id))
    .where(eq(decaissements.projetId, id));

  const totalEnc = arrondi(
    encs.filter((e) => e.statut !== "prevu").reduce((s, e) => s + Number(e.montant), 0)
  );
  const totalDec = arrondi(
    decs.filter((d) => d.statut !== "prevu").reduce((s, d) => s + Number(d.montant), 0)
  );

  const freelancesVus = new Map<number, string>();
  for (const d of decs) freelancesVus.set(d.freelanceId, `${d.freelancePrenom} ${d.freelanceNom}`);

  return {
    ref: { type: "projet", id },
    titre: p.nom,
    sousTitre: p.actif ? "Projet actif" : "Projet terminé",
    actif: p.actif,
    actionLabel: "Terminer",
    champs: [
      { cle: "nom", label: "Nom du projet", valeur: p.nom, type: "text" },
      { cle: "budget", label: "Budget (€)", valeur: entier(p.budget), type: "number" },
    ],
    infos: [
      { label: "Statut commercial", valeur: labelStatutCommercial(p.statutCommercial) },
      { label: "Encaissé", valeur: formatEuro(totalEnc) },
      { label: "Décaissé", valeur: formatEuro(totalDec) },
      { label: "Marge", valeur: formatEuro(arrondi(totalEnc - totalDec)) },
      { label: "Reste à facturer", valeur: formatEuro(arrondi(Number(p.budget) - totalEnc)) },
    ],
    sections: [
      {
        titre: "Client",
        vide: "",
        liens: [{ ref: { type: "client", id: p.clientId }, label: p.clientNom }],
      },
      {
        titre: "Freelances impliqués",
        vide: "Aucun décaissement enregistré.",
        liens: Array.from(freelancesVus.entries()).map(([fid, nom]) => ({
          ref: { type: "freelance", id: fid },
          label: nom,
        })),
      },
    ],
  };
}

// Édition inline d'un champ d'entité (nom, TJM, budget...).
export async function modifierChampEntite(
  ref: EntiteRef,
  cle: string,
  valeur: string
): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const v = valeur.trim();

  if (ref.type === "user") {
    if (!estAdmin(session)) return { ok: false, message: "Accès refusé." };
    if (!["prenom", "nom"].includes(cle)) return { ok: false, message: "Champ inconnu." };
    await db.update(users).set({ [cle]: v || null }).where(eq(users.id, ref.id));
  } else if (ref.type === "freelance") {
    if (!["prenom", "nom"].includes(cle) || !v) return { ok: false, message: "Valeur invalide." };
    await db.update(freelances).set({ [cle]: v }).where(eq(freelances.id, ref.id));
  } else if (ref.type === "client") {
    if (cle !== "nom" || !v) return { ok: false, message: "Valeur invalide." };
    await db.update(clients).set({ nom: v }).where(eq(clients.id, ref.id));
  } else if (ref.type === "mission") {
    if (cle === "nom") {
      if (!v) return { ok: false, message: "Le nom est obligatoire." };
      await db.update(missions).set({ nom: v }).where(eq(missions.id, ref.id));
    } else if (cle === "tjmAchat" || cle === "tjmVente") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false, message: "Montant invalide." };
      await db.update(missions).set({ [cle]: String(n) }).where(eq(missions.id, ref.id));
    } else return { ok: false, message: "Champ inconnu." };
  } else if (ref.type === "projet") {
    if (cle === "nom") {
      if (!v) return { ok: false, message: "Le nom est obligatoire." };
      await db.update(projets).set({ nom: v }).where(eq(projets.id, ref.id));
    } else if (cle === "budget") {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return { ok: false, message: "Budget invalide." };
      // Même règle que modifierProjet : le budget ne peut pas passer sous le
      // total des échéances de recettes déjà saisies (prévues + encaissées).
      const lignes = await db
        .select({ montant: encaissements.montant })
        .from(encaissements)
        .where(eq(encaissements.projetId, ref.id));
      const saisi = lignes.reduce((s, l) => s + Number(l.montant), 0);
      if (n < saisi) {
        return {
          ok: false,
          message: `Le budget ne peut pas être inférieur au total des échéances déjà saisies (${formatEuro(saisi)}).`,
        };
      }
      await db.update(projets).set({ budget: String(n) }).where(eq(projets.id, ref.id));
    } else if (cle === "statutCommercial") {
      await db
        .update(projets)
        .set({ statutCommercial: normaliserStatutCommercial(v) })
        .where(eq(projets.id, ref.id));
    } else return { ok: false, message: "Champ inconnu." };
  } else {
    return { ok: false, message: "Type inconnu." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// Bascule actif / inactif d'une entité (bouton « Archiver » / « Désactiver »).
export async function basculerActif(ref: EntiteRef): Promise<{ ok: boolean; actif?: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const table =
    ref.type === "freelance"
      ? freelances
      : ref.type === "client"
        ? clients
        : ref.type === "mission"
          ? missions
          : ref.type === "projet"
            ? projets
            : null;
  if (!table) return { ok: false };

  const [ligne] = await db.select({ actif: table.actif }).from(table).where(eq(table.id, ref.id));
  if (!ligne) return { ok: false };
  const nouveau = !ligne.actif;
  await db.update(table).set({ actif: nouveau }).where(eq(table.id, ref.id));

  revalidatePath("/", "layout");
  return { ok: true, actif: nouveau };
}
