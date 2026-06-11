import postgres from "postgres";

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL ou DATABASE_URL_UNPOOLED manquant");
  }
  return databaseUrl;
}

export function createSqlClient() {
  const databaseUrl = getDatabaseUrl();
  const utilisePooler =
    databaseUrl.includes("-pooler.") || databaseUrl.includes("pgbouncer=true");

  return postgres(databaseUrl, {
    prepare: !utilisePooler,
  });
}
