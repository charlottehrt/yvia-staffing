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

// --- UTILISATEURS (les 3 associés qui se connectent à l'app) ---
// Créés à la main (pas d'inscription publique). Mot de passe stocké haché.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nom: text("nom"), // nom affiché, optionnel
});

// --- FREELANCES ---
export const freelances = pgTable("freelances", {
  id: serial("id").primaryKey(), // identifiant unique, généré automatiquement
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  actif: boolean("actif").notNull().default(true), // true = actif, false = inactif
});

// --- CLIENTS ---
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(), // nom de la société
  actif: boolean("actif").notNull().default(true), // true = actif, false = archivé
});

// --- MISSIONS ---
// Une mission relie un freelance à un client et porte son tarif courant (TJM).
// Le tarif n'est plus historisé : un seul couple achat/vente par mission.
export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  // Références : on relie la mission à un freelance et à un client existants.
  freelanceId: integer("freelance_id")
    .notNull()
    .references(() => freelances.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  nom: text("nom").notNull(), // libellé de la mission
  // Tarif courant de la mission, en € HT. Recopié sur chaque jour d'affectation.
  tjmAchat: numeric("tjm_achat", { precision: 10, scale: 2 }).notNull(), // ce qu'on paie au freelance
  tjmVente: numeric("tjm_vente", { precision: 10, scale: 2 }).notNull(), // ce qu'on facture au client
  // Statut manuel actif / inactif (bouton "Désactiver").
  actif: boolean("actif").notNull().default(true),
});

// --- AFFECTATIONS (planning jour par jour) ---
// Un jour donné, un freelance est rattaché à une mission. La contrainte d'unicité
// garantit qu'un freelance ne peut être affecté qu'à une seule mission par jour.
// Le TJM est figé : il est recopié de la mission au moment où le jour est posé,
// pour qu'une modification ultérieure du tarif de la mission ne change pas le passé.
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
    tjmAchat: numeric("tjm_achat", { precision: 10, scale: 2 }).notNull(), // copie figée du TJM achat
    tjmVente: numeric("tjm_vente", { precision: 10, scale: 2 }).notNull(), // copie figée du TJM vente
  },
  (t) => [unique("un_freelance_par_jour").on(t.freelanceId, t.date)]
);

// --- PROJETS (forfait) ---
// Une enveloppe budgétaire vendue à un client. La trésorerie est suivie via des
// événements datés : encaissements (côté client) et décaissements (côté freelances).
export const projets = pgTable("projets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  nom: text("nom").notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull(), // € HT, enveloppe vendue
  actif: boolean("actif").notNull().default(true), // true = actif, false = archivé
});

// --- ENCAISSEMENTS (argent reçu du client, rattaché à un projet) ---
export const encaissements = pgTable("encaissements", {
  id: serial("id").primaryKey(),
  projetId: integer("projet_id")
    .notNull()
    .references(() => projets.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(), // € HT
  libelle: text("libelle"), // optionnel (ex : acompte, jalon 1...)
});

// --- DECAISSEMENTS (argent versé à un freelance, rattaché à un projet) ---
export const decaissements = pgTable("decaissements", {
  id: serial("id").primaryKey(),
  projetId: integer("projet_id")
    .notNull()
    .references(() => projets.id, { onDelete: "cascade" }),
  freelanceId: integer("freelance_id")
    .notNull()
    .references(() => freelances.id),
  date: date("date").notNull(),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(), // € HT
  libelle: text("libelle"), // optionnel
});
