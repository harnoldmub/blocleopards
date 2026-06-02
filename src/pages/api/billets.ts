import type { APIRoute } from "astro";
import { requireDatabase } from "../../lib/neon";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const body = await request.json();
    const { match_key, first_name, last_name, date_of_birth, phone, email, country, country_code, city, source } = body;

    if (!match_key || !first_name || !last_name || !email) {
      return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400, headers });
    }

    if (!["rdc-denmark", "rdc-chili"].includes(match_key)) {
      return new Response(JSON.stringify({ error: "Match invalide." }), { status: 400, headers });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email invalide." }), { status: 400, headers });
    }

    const sql = requireDatabase();

    const existing = await sql`
      select id from inscriptions_billets
      where lower(email) = ${email.toLowerCase().trim()}
      and match_key = ${match_key}
    `;

    if (existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Tu as déjà une demande pour ce match. Une seule demande par supporter." }),
        { status: 409, headers }
      );
    }

    await sql`
      insert into inscriptions_billets (
        match_key, first_name, last_name, date_of_birth, phone, email,
        country, country_code, city, source
      ) values (
        ${match_key},
        ${first_name.trim()},
        ${last_name.trim()},
        ${date_of_birth || null},
        ${phone?.trim() || null},
        ${email.toLowerCase().trim()},
        ${country?.trim() || null},
        ${country_code?.trim() || null},
        ${city?.trim() || null},
        ${source || "formulaire"}
      )
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Billet inscription error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur. Réessaie dans quelques instants." }), { status: 500, headers });
  }
};
