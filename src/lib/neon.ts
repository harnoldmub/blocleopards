import { neon, neonConfig } from "@neondatabase/serverless";

// Forcer HTTP/fetch au lieu de WebSocket pour Node standalone
// (plus fiable dans les environments type Replit/Railway)
neonConfig.fetchConnectionCache = true;

const databaseUrl = import.meta.env.DATABASE_URL;

export const hasDatabase = Boolean(databaseUrl);

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!databaseUrl) return null;
  if (!_sql) _sql = neon(databaseUrl);
  return _sql;
}

export const sql = getSql();

export function requireDatabase() {
  const db = getSql();
  if (!db) {
    throw new Error(
      `DATABASE_URL non configurée. Vérifiez les variables d'environnement du serveur.`
    );
  }
  return db;
}
