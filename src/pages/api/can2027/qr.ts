import type { APIRoute } from "astro";
import QRCode from "qrcode";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const reservation = url.searchParams.get("reservation")?.trim() || "";
  if (!/^BL-2026-\d{6}$/.test(reservation)) return new Response(JSON.stringify({ error: "Identifiant de réservation invalide." }), { status: 400, headers: { "Content-Type": "application/json" } });
  const verificationUrl = new URL("/billetterie/verification", url.origin);
  verificationUrl.searchParams.set("reservation", reservation);
  const qr = await QRCode.toDataURL(verificationUrl.toString(), { width: 220, margin: 1 });
  return new Response(JSON.stringify({ qr }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
