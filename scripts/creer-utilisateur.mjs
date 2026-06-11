// Crée (ou réinitialise) un compte associé.
// Usage : npm run creer-utilisateur -- <email> <motDePasse> [nom]
// Pas d'inscription publique : c'est le seul moyen de créer un accès.

import "dotenv/config";
import { scryptSync, randomBytes } from "node:crypto";
import { createSqlClient } from "./db-url.mjs";

const [email, motDePasse, nom] = process.argv.slice(2);

if (!email || !motDePasse) {
  console.error('Usage : npm run creer-utilisateur -- <email> <motDePasse> ["Nom"]');
  process.exit(1);
}

function hasher(mdp) {
  const sel = randomBytes(16);
  const hash = scryptSync(mdp, sel, 64);
  return `scrypt$${sel.toString("hex")}$${hash.toString("hex")}`;
}

const sql = createSqlClient();
try {
  await sql`
    INSERT INTO users (email, password_hash, nom)
    VALUES (${email.toLowerCase()}, ${hasher(motDePasse)}, ${nom ?? null})
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, nom = EXCLUDED.nom`;
  console.log(`Compte enregistré : ${email.toLowerCase()}`);
} finally {
  await sql.end();
}
