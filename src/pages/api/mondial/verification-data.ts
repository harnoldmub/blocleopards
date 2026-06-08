import type { APIRoute } from "astro";
import { requireDatabase, hasDatabase } from "../../../lib/neon";
import { getSetting } from "../../../lib/settings";

export const prerender = false;

// Public endpoint — returns the published draw summary without identity documents.
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

    const winners = await sql`
      select id, selected_match_key
      from mondial_inscriptions
      where ticket_given_at is not null
      order by selected_match_key asc, ticket_given_at asc
    `;

    const logs = await sql`
      select id, match_key, candidates_count, winners_count, published, ran_at
      from mondial_tirage_logs
      order by ran_at asc
    `;

    return new Response(JSON.stringify({
      publishedWinnerIds: winners.map((w: any) => w.id),
      winnersByMatch: winners.reduce((groups: Record<string, number[]>, winner: any) => {
        const key = winner.selected_match_key || "non-renseigne";
        groups[key] = groups[key] || [];
        groups[key].push(winner.id);
        return groups;
      }, {}),
      drawHistory: logs,
    }), { status: 200, headers });
  } catch (err) {
    console.error("Verification data error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
