// Configuration de "drizzle-kit", l'outil qui crée/met à jour les tables
// dans la base à partir de src/db/schema.ts.

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL ou DATABASE_URL_UNPOOLED manquant");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // dossier de suivi des changements de schéma
  dialect: "postgresql",
  dbCredentials: {
    // En production Neon, utiliser l'URL directe pour les changements de schema
    // quand elle est disponible. L'application peut garder l'URL poolée.
    url: databaseUrl,
  },
});
