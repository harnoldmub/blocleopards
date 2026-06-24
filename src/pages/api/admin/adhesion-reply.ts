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
    const { id, to, body, notes } = await request.json();
    if (!id || !to || !body?.trim()) {
      return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400, headers });
    }

    const sent = await sendContactReply({ to: String(to), objet: "Votre adhésion au Bloc Léopards", body: String(body) });
    if (!sent.ok) {
      return new Response(JSON.stringify({ error: sent.error || "Échec de l'envoi." }), { status: 502, headers });
    }

    // Trace la réponse dans les notes admin (sans changer le statut d'adhésion)
    const sql = requireDatabase();
    if (notes != null) {
      await sql`update adhesions set admin_notes = ${notes} where id = ${id}`;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Adhesion reply error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
