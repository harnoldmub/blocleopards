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
    sql`select * from newsletter_subscriptions order by created_at desc`,
    sql`select count(*) as total from newsletter_subscriptions`,
  ]);
  return new Response(JSON.stringify({ subscribers: rows, stats: stats[0] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400 });
  const sql = requireDatabase();
  await sql`delete from newsletter_subscriptions where id = ${id}`;
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
