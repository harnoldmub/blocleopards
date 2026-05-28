import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const [billets, adhesions, contacts, newsletter] = await Promise.all([
    sql`select
      count(*) filter (where true) as total,
      count(*) filter (where match_key = 'rdc-denmark') as denmark,
      count(*) filter (where match_key = 'rdc-chili') as chili,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'selected') as selected,
      count(*) filter (where status = 'ticket_given') as ticket_given,
      count(*) filter (where status = 'rejected') as rejected
    from inscriptions_billets`,
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
  ]);

  return new Response(JSON.stringify({
    billets: billets[0],
    adhesions: adhesions[0],
    contacts: contacts[0],
    newsletter: newsletter[0],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
