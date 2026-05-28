import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401, headers });
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  const sql = requireDatabase();
  await sql`delete from inscriptions_billets where id = ${id}`;
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401, headers });
  const { id, first_name, last_name, email, phone, city, country } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  const sql = requireDatabase();
  await sql`
    update inscriptions_billets set
      first_name = coalesce(${first_name ?? null}, first_name),
      last_name   = coalesce(${last_name  ?? null}, last_name),
      email       = coalesce(${email      ?? null}, email),
      phone       = coalesce(${phone      ?? null}, phone),
      city        = coalesce(${city       ?? null}, city),
      country     = coalesce(${country    ?? null}, country),
      updated_at  = now()
    where id = ${id}
  `;
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

export const GET: APIRoute = async ({ cookies }) => {
  const headers = { "Content-Type": "application/json" };

  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401, headers });
  }

  try {
    const sql = requireDatabase();

    const [rows, stats] = await Promise.all([
      sql`
        select
          id, match_key, first_name, last_name, phone, email,
          country, country_code, city, source, status,
          created_at, updated_at, ticket_given_at, validated_by_admin
        from inscriptions_billets
        order by created_at desc
      `,
      sql`
        select
          count(*) filter (where true) as total,
          count(*) filter (where match_key = 'rdc-denmark') as denmark,
          count(*) filter (where match_key = 'rdc-chili') as chili,
          count(*) filter (where status = 'pending') as pending,
          count(*) filter (where status = 'selected') as selected,
          count(*) filter (where status = 'ticket_given') as ticket_given,
          count(*) filter (where status = 'rejected') as rejected
        from inscriptions_billets
      `
    ]);

    return new Response(
      JSON.stringify({
        inscriptions: rows,
        stats: stats[0]
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Admin billets GET error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
