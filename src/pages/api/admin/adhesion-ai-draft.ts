import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { draftAdhesionReply } from "../../../lib/ai";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  try {
    const { prenom, nom, role, ville, motivation, consigne } = await request.json();
    if (!prenom) {
      return new Response(JSON.stringify({ error: "prénom requis" }), { status: 400, headers });
    }
    const { draft, source } = await draftAdhesionReply({
      prenom: String(prenom),
      nom: String(nom || ""),
      role: role ? String(role) : null,
      ville: ville ? String(ville) : null,
      motivation: motivation ? String(motivation) : null,
      consigne: consigne ? String(consigne) : undefined,
    });
    return new Response(JSON.stringify({ draft, source }), { status: 200, headers });
  } catch (err) {
    console.error("Adhesion AI draft error:", err);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération." }), { status: 500, headers });
  }
};
