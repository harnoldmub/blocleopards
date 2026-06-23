import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";
import { MATCHES, daysSince, purgeMatchDocuments } from "../../../lib/matches";

export const prerender = false;

// Délai (jours) après un match avant purge automatique des pièces justificatives.
const DELAY_DAYS = Number(process.env.PURGE_DELAY_DAYS ?? import.meta.env.PURGE_DELAY_DAYS ?? 30);

function authorized(request: Request): boolean {
  // process.env en priorité : le secret est lu au runtime (rotation sans rebuild)
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  if (!secret) return false; // désactivé tant que non configuré
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("key") === secret;
}

async function run(request: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json" };
  if (!authorized(request)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }

  const sql = requireDatabase();
  const results: { match: string; purged: number }[] = [];
  let totalPurged = 0;

  for (const m of MATCHES) {
    if (m.source === "billets") continue; // pas de pièces justificatives
    if (daysSince(m.date) < DELAY_DAYS) continue; // match trop récent
    try {
      const purged = await purgeMatchDocuments(sql, m);
      if (purged > 0) { results.push({ match: m.key, purged }); totalPurged += purged; }
    } catch (err) {
      console.error(`Purge auto ${m.key} échouée:`, err);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    delayDays: DELAY_DAYS,
    totalPurged,
    results,
    ranAt: new Date().toISOString(),
  }), { status: 200, headers });
}

export const POST: APIRoute = ({ request }) => run(request);
export const GET: APIRoute = ({ request }) => run(request);
