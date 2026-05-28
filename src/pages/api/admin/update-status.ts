import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

const VALID_STATUSES = ["pending", "selected", "ticket_given", "rejected"] as const;
type Status = (typeof VALID_STATUSES)[number];

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };

  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401, headers });
  }

  try {
    const body = await request.json();
    const { id, status } = body as { id: string; status: Status };

    if (!id || !VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: "Données invalides." }), { status: 400, headers });
    }

    const sql = requireDatabase();

    const ticketGivenAt = status === "ticket_given" ? sql`now()` : sql`null`;
    const validatedBy = status !== "pending" ? "admin" : null;

    await sql`
      update inscriptions_billets
      set
        status = ${status},
        updated_at = now(),
        ticket_given_at = ${ticketGivenAt},
        validated_by_admin = ${validatedBy}
      where id = ${id}
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Update status error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};
