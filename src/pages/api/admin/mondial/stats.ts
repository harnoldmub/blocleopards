import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }

  try {
    const sql = requireDatabase();

    const [generalStats] = await sql`
      select 
        count(*)::integer as total,
        count(*) filter (where verification_status = 'pending')::integer as pending,
        count(*) filter (where verification_status = 'verified')::integer as verified,
        count(*) filter (where verification_status = 'flagged')::integer as flagged,
        count(*) filter (where verification_status = 'rejected')::integer as rejected
      from mondial_inscriptions
    `;

    const stateStats = await sql`
      select state_us, count(*)::integer as count
      from mondial_inscriptions
      group by state_us
      order by count desc
    `;

    const [settings] = await sql`
      select value from settings where key = 'mondial_tickets_count'
    `;
    const ticketsAvailable = settings ? parseInt(settings.value) : 500;

    const [settingsTirage] = await sql`
      select value from settings where key = 'mondial_tirage_publie'
    `;
    const tiragePublie = settingsTirage?.value === "true";

    const [settingsSeed] = await sql`
      select value from settings where key = 'mondial_tirage_seed'
    `;
    const tirageSeed = settingsSeed?.value || "";

    const [settingsHash] = await sql`
      select value from settings where key = 'mondial_tirage_hash'
    `;
    const tirageHash = settingsHash?.value || "";

    return new Response(
      JSON.stringify({
        total: generalStats?.total || 0,
        pending: generalStats?.pending || 0,
        verified: generalStats?.verified || 0,
        flagged: generalStats?.flagged || 0,
        rejected: generalStats?.rejected || 0,
        statesCount: stateStats.length,
        stateDistribution: stateStats,
        ticketsAvailable,
        tiragePublie,
        tirageSeed,
        tirageHash
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Admin stats API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
