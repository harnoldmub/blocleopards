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

    const rows = await sql`
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
        m.ticket_given_at,
        m.created_at,
        j.id as document_id,
        j.type_document,
        j.mime_type as document_mime_type,
        j.original_filename,
        j.status as document_status,
        j.checksum as document_checksum,
        j.deleted_at as document_deleted_at
      from mondial_inscriptions m
      left join justificatifs_identite j on j.inscription_id = m.id
      order by m.created_at desc
    `;

    const grouped = new Map<string, any>();
    for (const row of rows) {
      const id = String(row.id);
      if (!grouped.has(id)) {
        grouped.set(id, {
          ...row,
          documents: [],
          document_id: null,
          type_document: null,
          document_mime_type: null,
          original_filename: null,
          document_status: null,
          document_checksum: null,
          document_deleted_at: null,
          portrait_document_id: null,
          portrait_original_filename: null,
          portrait_mime_type: null,
          portrait_status: null,
          portrait_deleted_at: null
        });
      }

      const item = grouped.get(id);
      if (!row.document_id) continue;

      const document = {
        id: row.document_id,
        type_document: row.type_document,
        mime_type: row.document_mime_type,
        original_filename: row.original_filename,
        status: row.document_status,
        checksum: row.document_checksum,
        deleted_at: row.document_deleted_at
      };
      item.documents.push(document);

      if (row.type_document === "PHOTO") {
        item.portrait_document_id = row.document_id;
        item.portrait_original_filename = row.original_filename;
        item.portrait_mime_type = row.document_mime_type;
        item.portrait_status = row.document_status;
        item.portrait_deleted_at = row.document_deleted_at;
      } else {
        item.document_id = row.document_id;
        item.type_document = row.type_document;
        item.document_mime_type = row.document_mime_type;
        item.original_filename = row.original_filename;
        item.document_status = row.document_status;
        item.document_checksum = row.document_checksum;
        item.document_deleted_at = row.document_deleted_at;
      }
    }

    const inscriptions = Array.from(grouped.values());

    return new Response(JSON.stringify({ inscriptions }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Admin inscriptions API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
