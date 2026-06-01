import type { APIRoute } from "astro";

export const prerender = false;

const SITE = "https://blocleopards.com";
const TODAY = new Date().toISOString().slice(0, 10);

const STATIC_PAGES = [
  { path: "/",                  priority: "1.0", changefreq: "daily" },
  { path: "/gagne-ton-billet",  priority: "0.9", changefreq: "weekly" },
  { path: "/evenements",        priority: "0.9", changefreq: "weekly" },
  { path: "/rejoindre",         priority: "0.8", changefreq: "monthly" },
  { path: "/mouvement",         priority: "0.7", changefreq: "monthly" },
  { path: "/actus",             priority: "0.7", changefreq: "weekly" },
  { path: "/campagnes",         priority: "0.7", changefreq: "monthly" },
  { path: "/media",             priority: "0.6", changefreq: "weekly" },
  { path: "/partenaires",       priority: "0.6", changefreq: "monthly" },
  { path: "/matchs",            priority: "0.6", changefreq: "weekly" },
  { path: "/contact",           priority: "0.5", changefreq: "yearly" },
  { path: "/charte",            priority: "0.5", changefreq: "yearly" },
  { path: "/kit-supporters",    priority: "0.5", changefreq: "monthly" },
  { path: "/mentions-legales",  priority: "0.2", changefreq: "yearly" },
  { path: "/confidentialite",   priority: "0.2", changefreq: "yearly" },
];

const EVENT_SLUGS = [
  "2026-05-26-entrainement-tata-raphael",
  "2026-06-03-rdc-danemark-liege",
  "2026-06-09-rdc-chili-marbella",
];

function url(path: string, priority: string, changefreq: string, lastmod = TODAY) {
  return `
  <url>
    <loc>${SITE}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: APIRoute = async () => {
  const staticUrls = STATIC_PAGES.map((p) => url(p.path, p.priority, p.changefreq)).join("");
  const eventUrls = EVENT_SLUGS.map((slug) => url(`/evenements/${slug}`, "0.8", "weekly")).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${eventUrls}
</urlset>`;

  return new Response(xml.trim(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
