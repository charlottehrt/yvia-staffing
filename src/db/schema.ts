// Le "schéma" décrit la forme de la base de données : les tables et leurs colonnes.
// Drizzle lira ce fichier pour créer (ou mettre à jour) les tables dans PostgreSQL.

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  numeric,
} from "drizzle-orm/pg-core";

// --- FREELANCES ---
export const freelances = pgTable("freelances", {
  id: serial("id").primaryKey(), // identifiant unique, généré automatiquement
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  email: text("email").notNull(),
  actif: boolean("actif").notNull().default(true), // true = actif, false = inactif
  notes: text("notes"), // optionnel (peut être vide)
});

// --- CLIENTS ---
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(), // nom de la société
  contactNom: text("contact_nom"), // optionnel
  contactEmail: text("contact_email"), // optionnel
  notes: text("notes"), // optionnel
});

// --- MISSIONS ---
export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  // Références : on relie la mission à un freelance et à un client existants.
  freelanceId: integer("freelance_id")
    .notNull()
    .references(() => freelances.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin"), // optionnel : vide = mission en cours sans terme défini
  // Décimales autorisées (0,5 à 7). numeric = nombre exact, idéal pour ce genre de valeur.
  joursParSemaine: numeric("jours_par_semaine", { precision: 3, scale: 1 })
    .notNull()
    .default("5"),
});

// --- TARIFS (périodes de tarification d'une mission) ---
// Une mission a au moins un tarif. Un nouveau tarif s'applique à partir d'un mois donné,
// ce qui conserve l'historique (option B validée dans la spec).
export const tarifs = pgTable("tarifs", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id, { onDelete: "cascade" }), // si on supprime la mission, ses tarifs partent avec
  moisEffet: date("mois_effet").notNull(), // toujours le 1er du mois (ex : 2026-07-01 = juillet 2026)
  tjmAchat: numeric("tjm_achat", { precision: 10, scale: 2 }).notNull(), // € HT
  tjmVente: numeric("tjm_vente", { precision: 10, scale: 2 }).notNull(), // € HT
});

// --- ABSENCES ---
// Rattachées à une mission précise (pas au freelance globalement), par mois.
export const absences = pgTable("absences", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id, { onDelete: "cascade" }),
  mois: date("mois").notNull(), // toujours le 1er du mois
  jours: numeric("jours", { precision: 4, scale: 1 }).notNull(), // demi-journées autorisées (0,5)
  motif: text("motif"), // optionnel : congés, maladie, autre
});
