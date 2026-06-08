import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }

  try {
    const sql = requireDatabase();

    const inscriptions = await sql`
      select 
        m.id,
        m.first_name,
        m.last_name,
        m.date_of_birth,
        m.email,
        m.phone,
        m.country,
        m.city,
        m.state_us,
        m.matchs_vises,
        m.opt_in_mur,
        m.ip_address,
        m.verification_status,
        m.anti_fraud_flags,
        m.created_at,
        j.id as document_id,
        j.type_document,
        j.original_filename,
        j.status as document_status,
        j.checksum as document_checksum,
        j.deleted_at as document_deleted_at
      from mondial_inscriptions m
      left join justificatifs_identite j on j.inscription_id = m.id
      order by m.created_at desc
    `;

    return new Response(JSON.stringify({ inscriptions }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Admin inscriptions API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
