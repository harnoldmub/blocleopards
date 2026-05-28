import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async () => {
  const sql = requireDatabase();
  const rows = await sql`SELECT * FROM articles WHERE published = true ORDER BY date DESC, created_at DESC`;
  return new Response(JSON.stringify({ articles: rows }), { headers: { "Content-Type": "application/json" } });
};
