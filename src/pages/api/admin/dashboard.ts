import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { getSetting } from "../../../lib/settings";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();

  const [adhesions, contacts, newsletter, mondialRaw, guadalajaraRaw] = await Promise.all([
    sql`select
      count(*) as total,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'validated') as validated,
      count(*) filter (where status = 'rejected') as rejected
    from adhesions`,
    sql`select
      count(*) as total,
      count(*) filter (where status = 'unread') as unread,
      count(*) filter (where status = 'read') as read,
      count(*) filter (where status = 'replied') as replied
    from contact_messages`,
    sql`select count(*) as total from newsletter_subscriptions`,
    sql`select
      count(*) as total,
      count(*) filter (where verification_status = 'verified') as verified,
      count(*) filter (where verification_status = 'pending') as pending,
      count(*) filter (where verification_status = 'flagged') as flagged,
      count(*) filter (where ticket_given_at is not null) as selected
    from mondial_inscriptions where programme = 'tirage_usa'`.catch(() => [{ total: 0, verified: 0, pending: 0, flagged: 0, selected: 0 }]),
    sql`select
      count(*) as total,
      count(*) filter (where verification_status = 'pending') as pending,
      count(*) filter (where ticket_given_at is not null) as selected,
      count(*) filter (where needs_lodging = true) as lodging
    from mondial_inscriptions where programme = 'ministere_guadalajara'`.catch(() => [{ total: 0, pending: 0, selected: 0, lodging: 0 }]),
  ]);

  const tiragePublie = (await getSetting("mondial_tirage_publie", "false")) === "true";

  return new Response(JSON.stringify({
    adhesions: adhesions[0],
    contacts: contacts[0],
    newsletter: newsletter[0],
    mondial: { ...(mondialRaw[0] || {}), tiragePublie },
    guadalajara: guadalajaraRaw[0] || { total: 0, pending: 0, selected: 0, lodging: 0 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
