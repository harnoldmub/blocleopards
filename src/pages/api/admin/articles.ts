import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const rows = await sql`SELECT * FROM articles ORDER BY date DESC, created_at DESC`;
  return new Response(JSON.stringify({ articles: rows }), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const body = await request.json();
  const { slug, title, description, body: content, date, tags, image, video, audio, source_title, source_url, published } = body;
  if (!slug || !title || !description || !content || !date) {
    return new Response(JSON.stringify({ error: "Champs obligatoires manquants." }), { status: 400 });
  }
  const tagsArr = Array.isArray(tags) ? tags : [];
  const [row] = await sql`
    INSERT INTO articles (slug, title, description, body, date, tags, image, video, audio, source_title, source_url, published)
    VALUES (${slug}, ${title}, ${description}, ${content}, ${date}, ${tagsArr}, ${image || null}, ${video || null}, ${audio || null}, ${source_title || null}, ${source_url || null}, ${published !== false})
    RETURNING *
  `;
  return new Response(JSON.stringify({ article: row }), { status: 201, headers: { "Content-Type": "application/json" } });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const body = await request.json();
  const { id, slug, title, description, body: content, date, tags, image, video, audio, source_title, source_url, published } = body;
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400 });
  const tagsArr = Array.isArray(tags) ? tags : [];
  const [row] = await sql`
    UPDATE articles SET
      slug = ${slug}, title = ${title}, description = ${description}, body = ${content},
      date = ${date}, tags = ${tagsArr}, image = ${image || null}, video = ${video || null},
      audio = ${audio || null}, source_title = ${source_title || null}, source_url = ${source_url || null},
      published = ${published !== false}, updated_at = NOW()
    WHERE id = ${id} RETURNING *
  `;
  return new Response(JSON.stringify({ article: row }), { headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400 });
  await sql`DELETE FROM articles WHERE id = ${id}`;
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
};
