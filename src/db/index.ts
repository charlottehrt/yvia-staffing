// Point de connexion à la base de données PostgreSQL locale (Docker).
// On utilise le pilote "postgres" + Drizzle.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant : vérifiez le fichier .env");
}

const databaseUrl = process.env.DATABASE_URL;
const utilisePooler =
  databaseUrl.includes("-pooler.") || databaseUrl.includes("pgbouncer=true");

// Astuce Next.js : en développement, le code est rechargé en boucle.
// On garde une seule connexion réutilisée pour ne pas en ouvrir des dizaines.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.client ??
  postgres(databaseUrl, {
    // Les URLs Neon poolées passent par PgBouncer en mode transaction.
    // Postgres.js doit alors éviter les prepared statements persistants.
    prepare: !utilisePooler,
  });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

// `db` est l'objet qu'on utilisera partout pour lire/écrire dans la base.
export const db = drizzle(client, { schema });
