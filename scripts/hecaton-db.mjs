#!/usr/bin/env node
// Lifecycle de la base PostgreSQL isolée fournie par Hecaton.
// `up` crée la base du worktree si elle n'existe pas ; `down` la supprime.

import postgres from "postgres";

const action = process.argv[2];
if (action !== "up" && action !== "down") {
  console.error("Usage : node scripts/hecaton-db.mjs <up|down>");
  process.exit(2);
}

const dbName = process.env.HECATON_DB;
const baseUrl = process.env.HECATON_DATABASE_URL;

if (!dbName) {
  console.error("[hecaton-db] HECATON_DB manquant.");
  process.exit(1);
}
if (!baseUrl) {
  console.error("[hecaton-db] HECATON_DATABASE_URL manquant.");
  process.exit(1);
}
if (!/^[a-z0-9_]+$/i.test(dbName)) {
  console.error(`[hecaton-db] Nom de base dangereux : ${dbName}`);
  process.exit(1);
}

const systemUrl = new URL(baseUrl);
systemUrl.pathname = "/postgres";
const sql = postgres(systemUrl.toString(), { prepare: false });
const ident = `"${dbName.replaceAll('"', '""')}"`;

try {
  if (action === "up") {
    try {
      await sql.unsafe(`CREATE DATABASE ${ident}`);
      console.log(`[hecaton-db] Base créée : ${dbName}`);
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        console.log(`[hecaton-db] Base déjà existante : ${dbName}`);
      } else {
        throw error;
      }
    }
  } else {
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${dbName}
        AND pid <> pg_backend_pid()
    `;
    await sql.unsafe(`DROP DATABASE IF EXISTS ${ident}`);
    console.log(`[hecaton-db] Base supprimée : ${dbName}`);
  }
} catch (error) {
  console.error(
    `[hecaton-db] ${action} impossible : ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
