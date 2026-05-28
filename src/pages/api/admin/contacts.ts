import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const [rows, stats] = await Promise.all([
    sql`select * from contact_messages order by created_at desc`,
    sql`select
      count(*) as total,
      count(*) filter (where status = 'unread') as unread,
      count(*) filter (where status = 'read') as read,
      count(*) filter (where status = 'replied') as replied
    from contact_messages`,
  ]);
  return new Response(JSON.stringify({ contacts: rows, stats: stats[0] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
