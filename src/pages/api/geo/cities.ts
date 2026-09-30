import type { APIRoute } from "astro";
import { getCityNames } from "../../../lib/geo";

export const prerender = false;

/** GET /api/geo/cities?country=CD → ["Bukavu", "Goma", "Kinshasa", …] */
export const GET: APIRoute = ({ url }) => {
  const country = (url.searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return new Response(JSON.stringify({ error: "country invalide" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify(getCityNames(country)), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" }
  });
};
