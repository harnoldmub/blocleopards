import type { APIRoute } from "astro";
import { randomInt } from "node:crypto";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const whatsappPattern = /^[\d\s+().-]{7,20}$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const whatsapp = String(body.whatsapp || "").trim();
    const country = String(body.country || "").trim();
    const quantity = Number(body.quantity);

    if (
      firstName.length < 2 ||
      lastName.length < 2 ||
      (email && !emailPattern.test(email)) ||
      !whatsappPattern.test(whatsapp) ||
      !country ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 4
    ) {
      return new Response(JSON.stringify({ error: "Informations de réservation invalides." }), { status: 400, headers });
    }

    const sql = requireDatabase();
    const unitPrice = 69000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reservationCode = `BL-2026-${randomInt(0, 1_000_000).toString().padStart(6, "0")}`;
      try {
        const rows = await sql`
          insert into billetterie_reservations (
            reservation_code, first_name, last_name, email, whatsapp, country,
            quantity, unit_price_fc, total_price_fc
          ) values (
            ${reservationCode}, ${firstName}, ${lastName}, ${email}, ${whatsapp}, ${country},
            ${quantity}, ${unitPrice}, ${unitPrice * quantity}
          )
          returning reservation_code, first_name, last_name, quantity, status, created_at
        `;
        return new Response(JSON.stringify({ success: true, reservation: rows[0] }), { status: 201, headers });
      } catch (error: any) {
        if (error?.code !== "23505" || attempt === 4) throw error;
      }
    }

    throw new Error("Impossible de générer un numéro de réservation unique.");
  } catch (error) {
    console.error("[billetterie] Échec de la réservation:", error);
    return new Response(JSON.stringify({ error: "La réservation n’a pas pu être enregistrée. Réessayez." }), { status: 500, headers });
  }
};
