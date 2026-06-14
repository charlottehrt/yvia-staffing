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
  prenom: text("prenom"),
  nom: text("nom"), // nom affiché, optionnel
  actif: boolean("actif").notNull().default(true),
  // Rôle : 'admin' (peut inviter d'autres utilisateurs) ou 'user'. Par défaut
  // 'admin' pour que les comptes associés existants conservent leurs droits.
  role: text("role").notNull().default("admin"),
});

// --- INVITATIONS (lien d'invitation pour créer un compte associé) ---
// Un associé connecté génère une invitation pour un email donné ; l'invité
// ouvre le lien et choisit son mot de passe. Usage unique, avec expiration.
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  prenom: text("prenom"),
  nom: text("nom"),
  expireLe: text("expire_le").notNull(), // date/heure ISO
  utilisee: boolean("utilisee").notNull().default(false),
  // Rôle attribué au compte créé via cette invitation (par défaut 'user').
  role: text("role").notNull().default("user"),
});

// --- FREELANCES ---
export const freelances = pgTable("freelances", {
  id: serial("id").primaryKey(), // identifiant unique, généré automatiquement
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  actif: boolean("actif").notNull().default(true), // true = actif, false = inactif
  // Préférence d'affichage : ligne visible ou non dans le planning du dashboard.
  // Sans effet sur les missions, affectations ou montants.
  afficherPlanning: boolean("afficher_planning").notNull().default(true),
});

// --- CLIENTS ---
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(), // nom de la société
  actif: boolean("actif").notNull().default(true), // true = actif, false = archivé
  // Fiabilité de paiement par défaut du client (catégorie : securise/probable/incertain/arisque).
  // Optionnel : sert de valeur par défaut dans la cascade du prévisionnel.
  fiabiliteDefaut: text("fiabilite_defaut"),
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
  actif: boolean("actif").notNull().default(true), // true = actif, false = terminé
  // Surcharge de fiabilité au niveau projet. Vide = hérite du client (cf. cascade prévisionnel).
  fiabiliteDefaut: text("fiabilite_defaut"),
  // Suivi CRM simple du sujet commercial.
  // Les projets existants en production seront migrés en "gagne".
  statutCommercial: text("statut_commercial").notNull().default("a_qualifier"),
});

// --- JALONS (forfait) : repères datés d'un projet, SANS impact financier ---
// Ni encaissement ni décaissement : juste une étape clé du projet (ex : kickoff,
// livraison V1, recette) qui s'affiche dans le planning pour donner du contexte.
export const jalons = pgTable("jalons", {
  id: serial("id").primaryKey(),
  projetId: integer("projet_id")
    .notNull()
    .references(() => projets.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  libelle: text("libelle").notNull(), // ce qui décrit l'étape (obligatoire)
});

// --- ENCAISSEMENTS / ÉCHÉANCIER DE RECETTE (argent du client, rattaché à un projet) ---
// Une ligne = une échéance de recette. statut='encaisse' = argent reçu (certain),
// statut='prevu' = paiement attendu (pondéré par sa fiabilité dans le prévisionnel).
export const encaissements = pgTable("encaissements", {
  id: serial("id").primaryKey(),
  projetId: integer("projet_id")
    .notNull()
    .references(() => projets.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // date réelle si encaissé, date attendue si prévu
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(), // € HT
  libelle: text("libelle"), // optionnel (ex : acompte, jalon 1...)
  statut: text("statut").notNull().default("encaisse"), // 'encaisse' | 'prevu'
  // Fiabilité propre à cette échéance (catégorie). Vide = hérite du projet/client.
  // N'a de sens que pour une échéance 'prevu'.
  fiabilite: text("fiabilite"),
});

// --- DECAISSEMENTS / ÉCHÉANCIER DE COÛT (versé à un freelance, rattaché à un projet) ---
// statut='decaisse' = déjà versé (réalisé), statut='prevu' = coût à venir.
// Pas de fiabilité côté coût : un coût engagé est considéré certain (100 %).
export const decaissements = pgTable("decaissements", {
  id: serial("id").primaryKey(),
  projetId: integer("projet_id")
    .notNull()
    .references(() => projets.id, { onDelete: "cascade" }),
  freelanceId: integer("freelance_id")
    .notNull()
    .references(() => freelances.id),
  date: date("date").notNull(), // date réelle si décaissé, date attendue si prévu
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(), // € HT
  libelle: text("libelle"), // optionnel
  statut: text("statut").notNull().default("decaisse"), // 'decaisse' | 'prevu'
});

// --- CHARGES FIXES (dépenses récurrentes, souvent des abonnements SaaS) ---
// Une charge porte un montant mensuel récurrent qui s'applique automatiquement
// à chaque mois entre sa date de début et, si renseignée, sa date de fin
// (abonnement résilié). Le montant d'un mois donné peut être ajusté ponctuellement
// via charges_fixes_valeurs (voir ci-dessous).
export const chargesFixes = pgTable("charges_fixes", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(), // ex : "Notion", "Figma", "Loyer"
  // Montant récurrent par défaut, en € (par mois). Appliqué à chaque mois actif.
  montantMensuel: numeric("montant_mensuel", { precision: 12, scale: 2 }).notNull(),
  dateDebut: date("date_debut").notNull(), // premier mois facturé
  dateFin: date("date_fin"), // dernier mois facturé (vide = toujours en cours)
  // Statut manuel : une charge archivée n'apparaît plus dans la grille active.
  actif: boolean("actif").notNull().default(true),
});

// --- VALEURS MENSUELLES D'UNE CHARGE FIXE (ajustement ponctuel) ---
// Une ligne existe seulement quand un mois est saisi explicitement : ce montant
// remplace alors le montant récurrent pour ce mois précis (ex : facturation
// annuelle, hausse de tarif, mois non payé à 0). Sans ligne, le mois utilise le
// montant récurrent de la charge.
export const chargesFixesValeurs = pgTable(
  "charges_fixes_valeurs",
  {
    id: serial("id").primaryKey(),
    chargeFixeId: integer("charge_fixe_id")
      .notNull()
      .references(() => chargesFixes.id, { onDelete: "cascade" }),
    mois: text("mois").notNull(), // "AAAA-MM"
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(), // € pour ce mois
  },
  (t) => [unique("une_valeur_par_charge_et_mois").on(t.chargeFixeId, t.mois)]
);
