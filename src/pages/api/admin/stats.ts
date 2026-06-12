import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();

  const empty: any[] = [];
  const [
    adhesionsDaily,
    mondialDaily,
    newsletterDaily,
    adhesionsByCity,
    adhesionsByRole,
    adhesionsByCountry,
    adhesionsByCanal,
    adhesionsStatus,
    mondialByState,
    mondialMatches,
    mondialStatus,
    mondialDiaspora,
    contactsStats,
    newsletterTotal,
    fraudFlags,
    supportersByCountry,
    supportersByCity,
    supportersTotal,
  ] = await Promise.all([
    sql`select date_trunc('day', created_at)::date as day, count(*) as count
        from adhesions where created_at > now() - interval '30 days'
        group by 1 order by 1`.catch(() => empty),
    sql`select date_trunc('day', created_at)::date as day, count(*) as count
        from mondial_inscriptions where created_at > now() - interval '30 days'
        group by 1 order by 1`.catch(() => empty),
    sql`select date_trunc('day', created_at)::date as day, count(*) as count
        from newsletter_subscriptions where created_at > now() - interval '30 days'
        group by 1 order by 1`.catch(() => empty),
    sql`select coalesce(nullif(trim(ville), ''), 'Non renseigné') as label, count(*) as count
        from adhesions group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select coalesce(nullif(trim(role), ''), 'Non renseigné') as label, count(*) as count
        from adhesions group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select coalesce(nullif(trim(pays), ''), 'Non renseigné') as label, count(*) as count
        from adhesions group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select coalesce(nullif(trim(canal), ''), 'Non renseigné') as label, count(*) as count
        from adhesions group by 1 order by count(*) desc limit 8`.catch(() => empty),
    sql`select status as label, count(*) as count from adhesions group by 1`.catch(() => empty),
    sql`select coalesce(nullif(trim(state_us), ''), coalesce(nullif(trim(city), ''), 'Non renseigné')) as label, count(*) as count
        from mondial_inscriptions group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select m.value as label, count(*) as count
        from mondial_inscriptions, jsonb_array_elements_text(matchs_vises) as m(value)
        group by 1 order by count(*) desc`.catch(() => empty),
    sql`select verification_status as label, count(*) as count
        from mondial_inscriptions group by 1`.catch(() => empty),
    sql`select case when is_diaspora_rdc then 'Diaspora RDC' else 'Autre' end as label, count(*) as count
        from mondial_inscriptions where is_diaspora_rdc is not null group by 1`.catch(() => empty),
    sql`select count(*) as total,
        count(*) filter (where status = 'unread') as unread,
        count(*) filter (where status = 'replied') as replied
        from contact_messages`.catch(() => [{ total: 0, unread: 0, replied: 0 }]),
    sql`select count(*) as total from newsletter_subscriptions`.catch(() => [{ total: 0 }]),
    sql`select count(*) filter (where jsonb_array_length(anti_fraud_flags) > 0) as flagged,
        count(*) as total from mondial_inscriptions`.catch(() => [{ flagged: 0, total: 0 }]),
    sql`select coalesce(nullif(trim(country), ''), 'Non renseigné') as label, count(*) as count
        from supporters group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select coalesce(nullif(trim(city), ''), 'Non renseigné') as label, count(*) as count
        from supporters group by 1 order by count(*) desc limit 10`.catch(() => empty),
    sql`select count(*) as total from supporters`.catch(() => [{ total: 0 }]),
  ]);

  return new Response(JSON.stringify({
    daily: {
      adhesions: adhesionsDaily,
      mondial: mondialDaily,
      newsletter: newsletterDaily,
    },
    adhesions: {
      byCity: adhesionsByCity,
      byRole: adhesionsByRole,
      byCountry: adhesionsByCountry,
      byCanal: adhesionsByCanal,
      byStatus: adhesionsStatus,
    },
    mondial: {
      byState: mondialByState,
      byMatch: mondialMatches,
      byStatus: mondialStatus,
      diaspora: mondialDiaspora,
      fraud: fraudFlags[0] || { flagged: 0, total: 0 },
    },
    supporters: {
      byCountry: supportersByCountry,
      byCity: supportersByCity,
      total: supportersTotal[0]?.total || 0,
    },
    contacts: contactsStats[0] || { total: 0, unread: 0, replied: 0 },
    newsletter: newsletterTotal[0] || { total: 0 },
    generatedAt: new Date().toISOString(),
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
