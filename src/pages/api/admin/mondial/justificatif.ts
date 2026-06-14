import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";
import { getObject } from "../../../../lib/storage";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response("Non autorisé", { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("ID manquant", { status: 400 });
  }

  try {
    const sql = requireDatabase();

    const [doc] = await sql`
      select id, inscription_id, original_filename, mime_type, file_data, storage_key, deleted_at
      from justificatifs_identite
      where id = ${id}
    `;

    if (!doc) {
      return new Response("Document introuvable", { status: 404 });
    }

    if (doc.deleted_at) {
      return new Response("Ce document a déjà été supprimé conformément aux règles RGPD.", { status: 410 });
    }

    // Log access (best-effort)
    try {
      await sql`
        insert into justificatifs_access_logs (admin_username, justificatif_id, action)
        values ('admin', ${id}, 'view')
      `;
    } catch { /* table missing — ignore */ }

    const headers = {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename="${doc.original_filename}"`,
      "Cache-Control": "private, max-age=3600"
    };

    // Priorité au stockage objet (S3), fallback bytea
    if (doc.storage_key) {
      const obj = await getObject(doc.storage_key);
      if (obj) return new Response(obj.body, { status: 200, headers });
    }
    if (doc.file_data) return new Response(doc.file_data, { status: 200, headers });

    return new Response("Fichier non disponible", { status: 404 });
  } catch (err) {
    console.error("Secure download API error:", err);
    return new Response("Erreur interne", { status: 500 });
  }
};
