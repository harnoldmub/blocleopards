import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const { id, status, notes } = await request.json();
  if (!id || !status) {
    return new Response(JSON.stringify({ error: "id et status requis" }), { status: 400 });
  }
  const valid = ["unread", "read", "replied"];
  if (!valid.includes(status)) {
    return new Response(JSON.stringify({ error: "Statut invalide" }), { status: 400 });
  }
  const sql = requireDatabase();
  await sql`
    update contact_messages
    set status = ${status}, admin_notes = ${notes ?? null}
    where id = ${id}
  `;
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
