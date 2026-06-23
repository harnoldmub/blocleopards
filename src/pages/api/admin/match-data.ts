import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { MATCHES, findMatch, isPast, purgeMatchDocuments, type MatchDef } from "../../../lib/matches";

export const prerender = false;

/** Demandes liées à un match selon sa source. */
async function countDemandes(sql: any, m: MatchDef): Promise<number> {
  try {
    if (m.source === "billets") {
      const [r] = await sql`select count(*)::int as n from inscriptions_billets where match_key = ${m.key}`;
      return r?.n ?? 0;
    }
    if (m.source === "guadalajara") {
      const [r] = await sql`select count(*)::int as n from mondial_inscriptions where programme = 'ministere_guadalajara'`;
      return r?.n ?? 0;
    }
    const [r] = await sql`select count(*)::int as n from mondial_inscriptions where matchs_vises @> ${JSON.stringify([m.key])}::jsonb`;
    return r?.n ?? 0;
  } catch { return 0; }
}

/** Pièces justificatives (non supprimées) liées à un match. */
async function countDocuments(sql: any, m: MatchDef): Promise<number> {
  if (m.source === "billets") return 0;
  try {
    if (m.source === "guadalajara") {
      const [r] = await sql`
        select count(*)::int as n from justificatifs_identite j
        join mondial_inscriptions m on m.id = j.inscription_id
        where m.programme = 'ministere_guadalajara' and j.deleted_at is null`;
      return r?.n ?? 0;
    }
    const [r] = await sql`
      select count(*)::int as n from justificatifs_identite j
      join mondial_inscriptions m on m.id = j.inscription_id
      where m.matchs_vises @> ${JSON.stringify([m.key])}::jsonb and j.deleted_at is null`;
    return r?.n ?? 0;
  } catch { return 0; }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const matches = [];
  for (const m of MATCHES) {
    matches.push({
      ...m,
      isPast: isPast(m.date),
      demandes: await countDemandes(sql, m),
      documents: await countDocuments(sql, m),
    });
  }
  return new Response(JSON.stringify({ matches }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  try {
    const { match_key, scope } = await request.json();
    const m = findMatch(match_key);
    if (!m) return new Response(JSON.stringify({ error: "Match inconnu." }), { status: 400, headers });
    if (!isPast(m.date)) {
      return new Response(JSON.stringify({ error: "Suppression autorisée uniquement pour les matchs passés." }), { status: 400, headers });
    }
    if (!["documents", "demandes"].includes(scope)) {
      return new Response(JSON.stringify({ error: "Portée invalide." }), { status: 400, headers });
    }

    const sql = requireDatabase();

    // 1. Purge des pièces justificatives (S3 + bytea), commune aux deux portées
    const purgedDocs = await purgeMatchDocuments(sql, m);

    if (scope === "documents") {
      return new Response(JSON.stringify({ success: true, purgedDocuments: purgedDocs }), { status: 200, headers });
    }

    // 2. scope === "demandes" : suppression des inscriptions
    let deleted = 0;
    if (m.source === "billets") {
      const [r] = await sql`with d as (delete from inscriptions_billets where match_key = ${m.key} returning 1) select count(*)::int as n from d`;
      deleted = r?.n ?? 0;
    } else if (m.source === "guadalajara") {
      const [r] = await sql`with d as (delete from mondial_inscriptions where programme = 'ministere_guadalajara' returning 1) select count(*)::int as n from d`;
      deleted = r?.n ?? 0;
    } else {
      // USA : ne supprime que les inscriptions ne visant QUE ce match (préserve le multi-match futur)
      const [r] = await sql`
        with d as (
          delete from mondial_inscriptions
          where matchs_vises @> ${JSON.stringify([m.key])}::jsonb
            and jsonb_array_length(matchs_vises) = 1
          returning 1
        ) select count(*)::int as n from d`;
      deleted = r?.n ?? 0;
    }

    return new Response(JSON.stringify({ success: true, purgedDocuments: purgedDocs, deletedDemandes: deleted }), { status: 200, headers });
  } catch (err) {
    console.error("Match data deletion error:", err);
    return new Response(JSON.stringify({ error: "Erreur lors de la suppression." }), { status: 500, headers });
  }
};
