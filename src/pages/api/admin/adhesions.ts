import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  const sql = requireDatabase();
  await sql`delete from adhesions where id = ${id}`;
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const [rows, stats] = await Promise.all([
    sql`select * from adhesions order by created_at desc`,
    sql`select
      count(*) as total,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'validated') as validated,
      count(*) filter (where status = 'rejected') as rejected,
      count(*) filter (where newsletter_opt_in = true) as newsletter
    from adhesions`,
  ]);
  return new Response(JSON.stringify({ adhesions: rows, stats: stats[0] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
