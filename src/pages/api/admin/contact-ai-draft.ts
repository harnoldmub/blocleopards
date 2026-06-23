import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { draftContactReply } from "../../../lib/ai";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  try {
    const { nom, objet, message, consigne } = await request.json();
    if (!nom || !objet) {
      return new Response(JSON.stringify({ error: "nom et objet requis" }), { status: 400, headers });
    }
    const { draft, source } = await draftContactReply({
      nom: String(nom),
      objet: String(objet),
      message: String(message || ""),
      consigne: consigne ? String(consigne) : undefined,
    });
    return new Response(JSON.stringify({ draft, source }), { status: 200, headers });
  } catch (err) {
    console.error("AI draft endpoint error:", err);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération." }), { status: 500, headers });
  }
};
