import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultSlug(title: string, date: string): string {
  return `${date}-${slugify(title)}`.replace(/-+$/g, "");
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  const sql = requireDatabase();
  const rows = await sql`
    SELECT *
    FROM events
    ORDER BY date ASC, created_at ASC
  `;

  return json({ events: rows });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  const sql = requireDatabase();
  const body = await request.json();
  const {
    title,
    description,
    body: content,
    date,
    time,
    location,
    cta,
    map,
    image,
    category,
    published,
  } = body;
  const slug = body.slug || (title && date ? defaultSlug(title, date) : "");

  if (!slug || !title || !description || !date) {
    return json({ error: "Titre, description et date sont obligatoires." }, 400);
  }

  const [row] = await sql`
    INSERT INTO events (slug, title, description, body, date, time, location, cta, map, image, category, published)
    VALUES (
      ${slug},
      ${title},
      ${description},
      ${content || ""},
      ${date},
      ${time || ""},
      ${location || ""},
      ${cta || ""},
      ${map || null},
      ${image || null},
      ${category || "event"},
      ${published !== false}
    )
    RETURNING *
  `;

  return json({ event: row }, 201);
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  const sql = requireDatabase();
  const body = await request.json();
  const {
    id,
    slug,
    title,
    description,
    body: content,
    date,
    time,
    location,
    cta,
    map,
    image,
    category,
    published,
  } = body;

  if (!id) return json({ error: "id requis" }, 400);
  if (!slug || !title || !description || !date) {
    return json({ error: "Titre, slug, description et date sont obligatoires." }, 400);
  }

  const [row] = await sql`
    UPDATE events SET
      slug = ${slug},
      title = ${title},
      description = ${description},
      body = ${content || ""},
      date = ${date},
      time = ${time || ""},
      location = ${location || ""},
      cta = ${cta || ""},
      map = ${map || null},
      image = ${image || null},
      category = ${category || "event"},
      published = ${published !== false},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return json({ event: row });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  const sql = requireDatabase();
  const { id } = await request.json();
  if (!id) return json({ error: "id requis" }, 400);

  await sql`DELETE FROM events WHERE id = ${id}`;
  return json({ success: true });
};
