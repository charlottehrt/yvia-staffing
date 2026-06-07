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
  unique,
} from "drizzle-orm/pg-core";

// --- FREELANCES ---
export const freelances = pgTable("freelances", {
  id: serial("id").primaryKey(), // identifiant unique, généré automatiquement
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  email: text("email"), // facultatif
  actif: boolean("actif").notNull().default(true), // true = actif, false = inactif
  notes: text("notes"), // optionnel (peut être vide)
});

// --- CLIENTS ---
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(), // nom de la société
  actif: boolean("actif").notNull().default(true), // true = actif, false = archivé
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
  dateDebut: date("date_debut"), // facultatif (le planning fait foi)
  dateFin: date("date_fin"), // facultatif
  // Décimales autorisées (0,5 à 7). Conservé pour compatibilité, plus utilisé dans le calcul.
  joursParSemaine: numeric("jours_par_semaine", { precision: 3, scale: 1 })
    .notNull()
    .default("5"),
  // Interrupteur manuel : la mission est-elle proposée dans le pop-up du planning ?
  disponiblePlanning: boolean("disponible_planning").notNull().default(true),
});

// --- AFFECTATIONS (planning jour par jour) ---
// Un jour donné, un freelance est rattaché à une mission. La contrainte d'unicité
// garantit qu'un freelance ne peut être affecté qu'à une seule mission par jour.
export const affectations = pgTable(
  "affectations",
  {
    id: serial("id").primaryKey(),
    missionId: integer("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    freelanceId: integer("freelance_id")
      .notNull()
      .references(() => freelances.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
  },
  (t) => [unique("un_freelance_par_jour").on(t.freelanceId, t.date)]
);

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
