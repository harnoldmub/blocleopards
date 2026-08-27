/**
 * Exécute un fichier .sql sur Neon via le driver HTTP (@neondatabase/serverless).
 * Alternative à psql, qui n'arrive pas toujours à joindre le pooler Neon.
 *   node scripts/run-sql.mjs db/migrations/015_....sql
 * Les instructions sont découpées sur les `;` en fin de ligne (hors littéraux).
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql.mjs <fichier.sql>");
  process.exit(1);
}

const env = readFileSync(".env", "utf8");
const url =
  process.env.DATABASE_URL ||
  env.match(/^DATABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL introuvable");
  process.exit(1);
}

const sql = neon(url);
const raw = readFileSync(file, "utf8");

// Découpage naïf mais suffisant ici : on suit les guillemets simples et les
// commentaires `--` pour ne pas couper sur un `;` contenu dans une chaîne.
const statements = [];
let buf = "";
let inString = false;
let inComment = false;
for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (inComment) {
    if (c === "\n") inComment = false;
    buf += c;
    continue;
  }
  if (inString) {
    if (c === "'" && raw[i - 1] !== "\\") inString = false;
    buf += c;
    continue;
  }
  if (c === "-" && raw[i + 1] === "-") { inComment = true; buf += c; continue; }
  if (c === "'") { inString = true; buf += c; continue; }
  if (c === ";") { statements.push(buf.trim()); buf = ""; continue; }
  buf += c;
}
if (buf.trim()) statements.push(buf.trim());

const runnable = statements.filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
console.log(`${file} → ${runnable.length} instruction(s)`);

for (const [i, statement] of runnable.entries()) {
  const label = statement.replace(/--[^\n]*/g, "").trim().slice(0, 70).replace(/\s+/g, " ");
  try {
    await sql.query(statement);
    console.log(`  ✓ [${i + 1}] ${label}…`);
  } catch (err) {
    console.error(`  ✗ [${i + 1}] ${label}…`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}
console.log("OK");
