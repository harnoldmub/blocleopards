import type { APIRoute } from "astro";
import { isAdminAuthed, hasPermission } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { billetterieMatches, matchKeyFor } from "../../../data/billetterie";

export const prerender = false;

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const STATUSES = ["pending", "paid", "cancelled"];

function guard(cookies: Parameters<typeof isAdminAuthed>[0]) {
  return isAdminAuthed(cookies) && hasPermission(cookies, "billetterie");
}

/** Toutes les réservations, chacune rattachée à son match. */
export const GET: APIRoute = async ({ cookies }) => {
  if (!guard(cookies)) return json({ error: "Non autorisé" }, 401);
  try {
    const sql = requireDatabase();
    const rows = await sql`
      select reservation_code, first_name, last_name, email, whatsapp, country,
             quantity, total_price_fc, status, created_at, updated_at
      from billetterie_reservations
      order by created_at desc
    `;
    const reservations = rows.map((row: any) => ({ ...row, match_key: matchKeyFor(row.created_at) }));
    const matches = billetterieMatches.map(({ key, label, date, venue, current }) => ({ key, label, date, venue, current }));
    return json({ matches, reservations });
  } catch (error) {
    console.error("[admin/billetterie] Lecture impossible:", error);
    return json({ error: "Impossible de charger les réservations." }, 500);
  }
};

/** Change le statut d'une réservation : à retirer, retirée ou annulée. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!guard(cookies)) return json({ error: "Non autorisé" }, 401);
  try {
    const body = await request.json();
    const code = String(body.code || "").trim();
    const status = String(body.status || "").trim();
    if (!/^BL-2026-[\w-]{3,20}$/.test(code) || !STATUSES.includes(status)) {
      return json({ error: "Demande invalide." }, 400);
    }
    const sql = requireDatabase();
    const rows = await sql`
      update billetterie_reservations
      set status = ${status}, updated_at = now()
      where reservation_code = ${code}
      returning reservation_code, status, updated_at
    `;
    if (rows.length === 0) return json({ error: "Réservation introuvable." }, 404);
    return json({ success: true, reservation: rows[0] });
  } catch (error) {
    console.error("[admin/billetterie] Mise à jour impossible:", error);
    return json({ error: "La mise à jour a échoué. Réessayez." }, 500);
  }
};
