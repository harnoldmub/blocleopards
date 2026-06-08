import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";
import fs from "fs";
import path from "path";

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

    // 1. Fetch document metadata
    const [doc] = await sql`
      select id, inscription_id, stored_filename, mime_type, original_filename, uploaded_at, deleted_at
      from justificatifs_identite
      where id = ${id}
    `;

    if (!doc) {
      return new Response("Document introuvable", { status: 404 });
    }

    if (doc.deleted_at) {
      return new Response("Ce document a déjà été supprimé conformément aux règles RGPD.", { status: 410 });
    }

    // 2. Log access
    const adminUsername = "admin"; // Mock or retrieve active session admin username
    await sql`
      insert into justificatifs_access_logs (
        admin_username, justificatif_id, action
      ) values (
        ${adminUsername}, ${id}, 'view'
      )
    `;

    // 3. Resolve file path
    const uploadedDate = new Date(doc.uploaded_at);
    const year = uploadedDate.getFullYear().toString();
    const month = (uploadedDate.getMonth() + 1).toString().padStart(2, "0");
    const filePath = path.join(process.cwd(), "private/justificatifs", year, month, doc.stored_filename);

    if (!fs.existsSync(filePath)) {
      console.error(`File path not found: ${filePath}`);
      return new Response("Fichier physique introuvable sur le serveur", { status: 404 });
    }

    // 4. Return file contents
    const fileBuffer = fs.readFileSync(filePath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": doc.mime_type,
        "Content-Disposition": `inline; filename="${doc.original_filename}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (err) {
    console.error("Secure download API error:", err);
    return new Response("Erreur interne", { status: 500 });
  }
};
