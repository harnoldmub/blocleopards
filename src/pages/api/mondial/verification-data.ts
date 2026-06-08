import type { APIRoute } from "astro";
import { requireDatabase, hasDatabase } from "../../../lib/neon";
import { getSetting } from "../../../lib/settings";

export const prerender = false;

// Public endpoint — returns only IDs (no PII), seed, hash and winner IDs
export const GET: APIRoute = async () => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!hasDatabase) {
    return new Response(JSON.stringify({ error: "DB non disponible." }), { status: 503, headers });
  }

  try {
    const tiragePublie = (await getSetting("mondial_tirage_publie", "false")) === "true";
    if (!tiragePublie) {
      return new Response(JSON.stringify({ error: "Le tirage n'est pas encore publié." }), { status: 404, headers });
    }

    const sql = requireDatabase();

    // All verified candidates in draw order (id asc) — IDs only, no PII
    const candidates = await sql`
      select id from mondial_inscriptions
      where verification_status = 'verified'
      order by id asc
    `;

    // Winners (those with ticket_given_at set) — IDs only
    const winners = await sql`
      select id from mondial_inscriptions
      where ticket_given_at is not null
      order by ticket_given_at asc
    `;

    const seed   = await getSetting("mondial_tirage_seed", "");
    const hash   = await getSetting("mondial_tirage_hash", "");
    const count  = parseInt(await getSetting("mondial_tickets_count", "0"), 10);

    return new Response(JSON.stringify({
      candidateIds: candidates.map((c: any) => c.id),
      seed,
      engagementHash: hash,
      winnersCount: count,
      publishedWinnerIds: winners.map((w: any) => w.id),
    }), { status: 200, headers });
  } catch (err) {
    console.error("Verification data error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
