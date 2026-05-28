import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const sql = requireDatabase();
  const { slug } = params;
  const [row] = await sql`SELECT * FROM articles WHERE slug = ${slug} AND published = true`;
  if (!row) return new Response(JSON.stringify({ error: "Article introuvable" }), { status: 404 });
  return new Response(JSON.stringify({ article: row }), { headers: { "Content-Type": "application/json" } });
};
