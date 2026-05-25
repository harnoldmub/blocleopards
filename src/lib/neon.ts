import { neon } from "@neondatabase/serverless";

const databaseUrl = import.meta.env.DATABASE_URL;

export const hasDatabase = Boolean(databaseUrl);

export const sql = hasDatabase ? neon(databaseUrl) : null;

export function requireDatabase() {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return sql;
}
