import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const code = String(body.code || "").trim();
    const checked = Boolean(body.checked);

    if (!/^BL-2026-\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Code de réservation invalide" }), { status: 400, headers });
    }

    const sql = requireDatabase();
    const newStatus = checked ? "paid" : "pending";

    const rows = await sql`
      update billetterie_reservations
      set status = ${newStatus}, updated_at = now()
      where reservation_code = ${code}
      returning reservation_code, status
    `;

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "Réservation introuvable" }), { status: 404, headers });
    }

    return new Response(JSON.stringify({ success: true, status: rows[0].status }), { status: 200, headers });
  } catch (error) {
    console.error("[billetterie] Erreur checkin:", error);
    return new Response(JSON.stringify({ error: "Erreur lors de la mise à jour" }), { status: 500, headers });
  }
};
