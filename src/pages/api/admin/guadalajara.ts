import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { deleteObject } from "../../../lib/storage";

export const prerender = false;

const VALID_STATUS = ["pending", "verified", "selected", "rejected", "flagged"];

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const [rows, stats] = await Promise.all([
    sql`
      select
        m.id,
        m.ticket_number as reference,
        m.first_name, m.last_name, m.email, m.phone, m.whatsapp,
        m.country, m.city, m.transport_type, m.needs_lodging,
        m.anti_fraud_flags, m.admin_notes, m.created_at,
        case when m.ticket_given_at is not null then 'selected' else m.verification_status end as status,
        coalesce(jsonb_agg(
          jsonb_build_object('id', j.id, 'type', j.type_document, 'filename', j.original_filename, 'mime', j.mime_type)
          order by j.type_document
        ) filter (where j.id is not null), '[]') as fichiers
      from mondial_inscriptions m
      left join justificatifs_identite j on j.inscription_id = m.id and j.deleted_at is null
      where m.programme = 'ministere_guadalajara'
      group by m.id
      order by m.created_at desc
    `,
    sql`select
      count(*) as total,
      count(*) filter (where verification_status = 'pending') as pending,
      count(*) filter (where verification_status = 'verified' and ticket_given_at is null) as verified,
      count(*) filter (where ticket_given_at is not null) as selected,
      count(*) filter (where verification_status = 'rejected') as rejected,
      count(*) filter (where verification_status = 'flagged') as flagged,
      count(*) filter (where needs_lodging = true) as lodging
    from mondial_inscriptions where programme = 'ministere_guadalajara'`,
  ]);
  return new Response(JSON.stringify({ demandes: rows, stats: stats[0] }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  const { id, status, notes } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  if (status && !VALID_STATUS.includes(status)) {
    return new Response(JSON.stringify({ error: "Statut invalide" }), { status: 400, headers });
  }
  const sql = requireDatabase();

  // 'selected' = billet attribué (ticket_given_at + match guadalajara). Sinon verification_status.
  if (status === "selected") {
    await sql`
      update mondial_inscriptions set
        verification_status = 'verified',
        ticket_given_at = now(),
        selected_match_key = 'guadalajara',
        admin_notes = coalesce(${notes ?? null}, admin_notes),
        updated_at = now()
      where id = ${id} and programme = 'ministere_guadalajara'
    `;
  } else if (status) {
    await sql`
      update mondial_inscriptions set
        verification_status = ${status},
        ticket_given_at = null,
        admin_notes = coalesce(${notes ?? null}, admin_notes),
        updated_at = now()
      where id = ${id} and programme = 'ministere_guadalajara'
    `;
  } else {
    await sql`
      update mondial_inscriptions set
        admin_notes = coalesce(${notes ?? null}, admin_notes),
        updated_at = now()
      where id = ${id} and programme = 'ministere_guadalajara'
    `;
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  const sql = requireDatabase();
  // Nettoie les objets S3 associés avant suppression (cascade supprime justificatifs)
  const fichiers = await sql`select storage_key from justificatifs_identite where inscription_id = ${id} and storage_key is not null`;
  for (const f of fichiers) await deleteObject(f.storage_key);
  await sql`delete from mondial_inscriptions where id = ${id} and programme = 'ministere_guadalajara'`;
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
