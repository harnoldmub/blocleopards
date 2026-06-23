import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { sendContactReply } from "../../../lib/email";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  try {
    const { id, to, objet, body, notes } = await request.json();
    if (!id || !to || !objet || !body?.trim()) {
      return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400, headers });
    }

    const sent = await sendContactReply({ to: String(to), objet: String(objet), body: String(body) });
    if (!sent.ok) {
      return new Response(JSON.stringify({ error: sent.error || "Échec de l'envoi." }), { status: 502, headers });
    }

    const sql = requireDatabase();
    await sql`
      update contact_messages
      set status = 'replied', admin_notes = ${notes ?? null}, replied_at = now()
      where id = ${id}
    `.catch(async () => {
      // colonne replied_at peut-être absente — repli sans elle
      await sql`update contact_messages set status = 'replied', admin_notes = ${notes ?? null} where id = ${id}`;
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Contact reply endpoint error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
