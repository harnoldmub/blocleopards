import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { normalizeCountry } from "../../../lib/supporters";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }
  const sql = requireDatabase();
  const [rows, stats] = await Promise.all([
    sql`select * from supporters order by last_name asc, first_name asc`,
    sql`select
      count(*) as total,
      count(distinct country) as countries,
      count(*) filter (where email is not null) as with_email,
      count(*) filter (where phone is not null) as with_phone
    from supporters`,
  ]);
  return new Response(JSON.stringify({ supporters: rows, stats: stats[0] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  try {
    const { rows, country } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Aucune ligne à importer." }), { status: 400, headers });
    }
    if (rows.length > 2000) {
      return new Response(JSON.stringify({ error: "Maximum 2000 lignes par import." }), { status: 400, headers });
    }

    const sql = requireDatabase();
    let inserted = 0, skipped = 0;

    for (const r of rows) {
      const firstName = (r.first_name || "").toString().trim();
      const lastName = (r.last_name || "").toString().trim();
      if (!firstName || !lastName) { skipped++; continue; }
      const email = (r.email || "").toString().trim().toLowerCase() || null;
      const phone = (r.phone || "").toString().trim() || null;
      const city = (r.city || "").toString().trim() || null;
      const rowCountry = (r.country || "").toString().trim() || country;

      // Dédoublonnage : email d'abord, sinon prénom+nom
      let dup: any[] = [];
      if (email) {
        dup = await sql`select id from supporters where lower(email) = ${email} limit 1`;
      }
      if (dup.length === 0) {
        dup = await sql`
          select id from supporters
          where lower(first_name) = ${firstName.toLowerCase()} and lower(last_name) = ${lastName.toLowerCase()}
          limit 1
        `;
      }
      if (dup.length > 0) { skipped++; continue; }

      await sql`
        insert into supporters (first_name, last_name, email, phone, city, country, tags)
        values (
          ${firstName}, ${lastName}, ${email}, ${phone}, ${city},
          ${normalizeCountry(rowCountry)},
          ${JSON.stringify(["import-csv"])}
        )
      `;
      inserted++;
    }

    return new Response(JSON.stringify({ success: true, inserted, skipped }), { status: 200, headers });
  } catch (err) {
    console.error("Supporters import error:", err);
    return new Response(JSON.stringify({ error: "Erreur lors de l'import." }), { status: 500, headers });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
  }
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers });
  const sql = requireDatabase();
  await sql`delete from supporters where id = ${id}`;
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
