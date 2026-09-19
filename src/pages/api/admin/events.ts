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

const DEFAULT_EVENTS = [
  {
    slug: "2026-09-21-stage-rdc-eliminatoires-can2027",
    title: "Stage FIFA & Rassemblement Léopards",
    description: "Préparation des éliminatoires CAN 2027",
    body: "Ouverture de la fenêtre FIFA de septembre 2026. Arrivée des 25 Léopards sélectionnés et entraînements à Kinshasa sous la direction de Sébastien Desabre.",
    date: "2026-09-21",
    time: "10h00",
    location: "Kinshasa, RDC",
    cta: "Suivre la préparation sur les réseaux du Bloc",
    image: "/media/can-2027/hero-players-bleu.webp",
    category: "event",
    published: true,
  },
  {
    slug: "2026-09-24-rdc-guinee-equatoriale",
    title: "RDC – Guinée équatoriale",
    description: "Éliminatoires CAN 2027 · Journée 1 (Groupe E)",
    body: "Première journée des éliminatoires de la CAN 2027. Les Léopards de la RDC reçoivent le Nzalang Nacional au Stade des Martyrs. Tous au stade ! Tour oyo biso nde.",
    date: "2026-09-24",
    time: "17h00 (Kinshasa)",
    location: "Stade des Martyrs, Kinshasa",
    cta: "Billetterie officielle & tribune Bloc des Léopards",
    image: "/media/can-2027/poster-equipe-bleu.webp",
    category: "match",
    published: true,
  },
  {
    slug: "2026-09-28-zimbabwe-rdc",
    title: "Zimbabwe – RDC",
    description: "Éliminatoires CAN 2027 · Journée 2 (Groupe E)",
    body: "Deuxième journée des éliminatoires CAN 2027. Déplacement crucial des Léopards à Harare pour affronter les Guerriers du Zimbabwe.",
    date: "2026-09-28",
    time: "15h00 (Kinshasa)",
    location: "National Sports Stadium, Harare",
    cta: "Retransmission en fan zone et mobilisation du Bloc",
    image: "/media/can-2027/poster-trio-rouge.webp",
    category: "match",
    published: true,
  },
  {
    slug: "2026-08-27-leopards-basket-rdc-angola",
    title: "RDC – Angola (Basket)",
    description: "Léopards Basket · Qualif. Mondial 2027",
    body: "Premier acte de la mission Dakar au Dakar Arena face à l'Angola pour les qualifications de la Coupe du Monde FIBA Qatar 2027.",
    date: "2026-08-27",
    time: "13h30 (Kinshasa)",
    location: "Dakar Arena, Sénégal",
    cta: "Diffusion DAZN Courtside",
    image: "/media/basket/gameday-rdc-angola.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-08-29-leopards-basket-rdc-mali",
    title: "RDC – Mali (Basket)",
    description: "Léopards Basket · Qualif. Mondial 2027",
    body: "Deuxième match de la fenêtre de qualification FIBA à Dakar.",
    date: "2026-08-29",
    time: "16h30 (Kinshasa)",
    location: "Dakar Arena, Sénégal",
    cta: "Diffusion DAZN Courtside",
    image: "/videos/basket/leopards-basket-02-poster.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-08-30-leopards-basket-rdc-egypte",
    title: "RDC – Égypte (Basket)",
    description: "Léopards Basket · Qualif. Mondial 2027",
    body: "Troisième et dernier match de la fenêtre de Dakar face à l'Égypte.",
    date: "2026-08-30",
    time: "13h30 (Kinshasa)",
    location: "Dakar Arena, Sénégal",
    cta: "Diffusion DAZN Courtside",
    image: "/videos/basket/leopards-basket-01-poster.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-06-17-rdc-portugal-houston",
    title: "RDC – Portugal",
    description: "Mondial 2026 · Phase de groupes",
    body: "Premier match de poule de la Coupe du Monde 2026 face au Portugal au NRG Stadium de Houston.",
    date: "2026-06-17",
    time: "18h00 UTC",
    location: "NRG Stadium, Houston (USA)",
    cta: "Programme diaspora et supporters",
    image: "/media/hommage-diaspora-cover.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-06-23-rdc-colombie-guadalajara",
    title: "RDC – Colombie",
    description: "Mondial 2026 · Phase de groupes",
    body: "Deuxième match de poule de la Coupe du Monde 2026 à Guadalajara. Billetterie et programme diaspora du Ministère des Sports.",
    date: "2026-06-23",
    time: "20h00 UTC",
    location: "Estadio Akron, Guadalajara (Mexique)",
    cta: "Programme hébergement & billets Guadalajara",
    image: "/media/hommage-diaspora-cover.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-06-27-rdc-ouzbekistan-atlanta",
    title: "RDC – Ouzbékistan",
    description: "Mondial 2026 · Phase de groupes",
    body: "Troisième match de poule de la Coupe du Monde 2026 au Mercedes-Benz Stadium d'Atlanta.",
    date: "2026-06-27",
    time: "19h30 UTC",
    location: "Mercedes-Benz Stadium, Atlanta (USA)",
    cta: "Mobilisation diaspora",
    image: "/media/hommage-diaspora-cover.jpg",
    category: "match",
    published: true,
  },
  {
    slug: "2026-11-12-can2027-j3-j4",
    title: "Fenêtre FIFA — Éliminatoires CAN 2027 (J3 & J4)",
    description: "Campagne officielle CAN 2027 · Groupe E",
    body: "Deuxième fenêtre officielle des éliminatoires CAN 2027.",
    date: "2026-11-12",
    time: "À confirmer",
    location: "Kinshasa / Déplacement",
    cta: "Informations à venir",
    image: "/media/can-2027/poster-wissa-gold.webp",
    category: "match",
    published: true,
  },
  {
    slug: "2027-03-24-can2027-j5-j6",
    title: "Fenêtre FIFA — Éliminatoires CAN 2027 (J5 & J6)",
    description: "Dernière ligne droite · Groupe E",
    body: "Phase finale des éliminatoires CAN 2027. Qualification directe en jeu pour nos Léopards.",
    date: "2027-03-24",
    time: "À confirmer",
    location: "Kinshasa / Déplacement",
    cta: "Informations à venir",
    image: "/media/can-2027/poster-wissa-gold.webp",
    category: "match",
    published: true,
  },
];

async function ensureEventsTable(sql: any) {
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists events (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      title text not null,
      description text not null,
      body text not null default '',
      date date not null,
      time text not null default '',
      location text not null default '',
      cta text not null default '',
      map text,
      image text,
      category text not null default 'event',
      published boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  try {
    const countRes = await sql`SELECT count(*)::int as count FROM events`;
    if (!countRes || !countRes[0] || countRes[0].count === 0) {
      for (const e of DEFAULT_EVENTS) {
        await sql`
          INSERT INTO events (slug, title, description, body, date, time, location, cta, image, category, published)
          VALUES (${e.slug}, ${e.title}, ${e.description}, ${e.body}, ${e.date}, ${e.time}, ${e.location}, ${e.cta}, ${e.image}, ${e.category}, ${e.published})
          ON CONFLICT (slug) DO NOTHING
        `;
      }
    }
  } catch (seedErr) {
    console.warn("[ensureEventsTable] Seed warning:", seedErr);
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  try {
    const sql = requireDatabase();
    await ensureEventsTable(sql);

    const rows = await sql`
      SELECT *
      FROM events
      ORDER BY date ASC, created_at ASC
    `;

    return json({ events: rows || [] });
  } catch (err: any) {
    console.error("[api/admin/events] GET error:", err);
    return json({ error: err?.message || "Erreur lors de la récupération des événements", events: [] }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  try {
    const sql = requireDatabase();
    await ensureEventsTable(sql);

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
  } catch (err: any) {
    console.error("[api/admin/events] POST error:", err);
    return json({ error: err?.message || "Erreur lors de la création de l'événement" }, 500);
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  try {
    const sql = requireDatabase();
    await ensureEventsTable(sql);

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
  } catch (err: any) {
    console.error("[api/admin/events] PUT error:", err);
    return json({ error: err?.message || "Erreur lors de la mise à jour de l'événement" }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) return json({ error: "Non autorisé" }, 401);

  try {
    const sql = requireDatabase();
    await ensureEventsTable(sql);

    const { id } = await request.json();
    if (!id) return json({ error: "id requis" }, 400);

    await sql`DELETE FROM events WHERE id = ${id}`;
    return json({ success: true });
  } catch (err: any) {
    console.error("[api/admin/events] DELETE error:", err);
    return json({ error: err?.message || "Erreur lors de la suppression de l'événement" }, 500);
  }
};
