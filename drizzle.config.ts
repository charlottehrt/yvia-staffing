// Configuration de "drizzle-kit", l'outil qui crée/met à jour les tables
// dans la base à partir de src/db/schema.ts.

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // dossier de suivi des changements de schéma
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
