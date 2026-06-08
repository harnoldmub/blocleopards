import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";
import { getSetting } from "../../../lib/settings";
import fs from "fs";
import path from "path";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("ID manquant", { status: 400 });
  }

  try {
    const tiragePublie = (await getSetting("mondial_tirage_publie", "false")) === "true";
    if (!tiragePublie) {
      return new Response("Photo non publiée", { status: 404 });
    }

    const sql = requireDatabase();
    const [doc] = await sql`
      select
        j.stored_filename,
        j.mime_type,
        j.original_filename,
        coalesce(j.uploaded_at, j.created_at) as uploaded_at
      from justificatifs_identite j
      join mondial_inscriptions m on m.id = j.inscription_id
      where j.id = ${id}
        and j.type_document = 'PHOTO'
        and j.deleted_at is null
        and m.ticket_given_at is not null
      limit 1
    `;

    if (!doc) {
      return new Response("Photo introuvable", { status: 404 });
    }

    const uploadedDate = new Date(doc.uploaded_at);
    const year = uploadedDate.getFullYear().toString();
    const month = (uploadedDate.getMonth() + 1).toString().padStart(2, "0");
    const filePath = path.join(process.cwd(), "private/justificatifs", year, month, doc.stored_filename);

    if (!fs.existsSync(filePath)) {
      return new Response("Fichier introuvable", { status: 404 });
    }

    return new Response(fs.readFileSync(filePath), {
      status: 200,
      headers: {
        "Content-Type": doc.mime_type,
        "Content-Disposition": `inline; filename="${doc.original_filename}"`,
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (err) {
    console.error("Public mondial photo API error:", err);
    return new Response("Erreur serveur", { status: 500 });
  }
};
