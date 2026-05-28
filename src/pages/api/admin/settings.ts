import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { invalidateSettings } from "../../../lib/settings";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  const sql = requireDatabase();
  const rows = await sql`select key, value, updated_at from settings`;
  const settings = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return new Response(JSON.stringify({ settings }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  const body = await request.json();
  const sql = requireDatabase();
  for (const [key, value] of Object.entries(body)) {
    await sql`
      insert into settings (key, value, updated_at) values (${key}, ${String(value)}, now())
      on conflict (key) do update set value = ${String(value)}, updated_at = now()
    `;
  }
  invalidateSettings();
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
