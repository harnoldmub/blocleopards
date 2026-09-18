import type { APIRoute } from "astro";
import { formValue } from "../../../lib/forms";
import { requireDatabase } from "../../../lib/neon";
import { upsertSupporter } from "../../../lib/supporters";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let nom = "";
    let telephone = "";
    let email = "";
    let ville = "";
    let matchChoix = "kinshasa";
    let message = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      nom = (body.nom || "").trim();
      telephone = (body.telephone || "").trim();
      email = (body.email || "").trim().toLowerCase();
      ville = (body.ville || "").trim();
      matchChoix = (body.matchChoix || "kinshasa").trim();
      message = (body.message || "").trim();
    } else {
      const formData = await request.formData();
      nom = formValue(formData, "nom").trim();
      telephone = formValue(formData, "telephone").trim();
      email = formValue(formData, "email").trim().toLowerCase();
      ville = formValue(formData, "ville").trim();
      matchChoix = formValue(formData, "matchChoix").trim() || "kinshasa";
      message = formValue(formData, "message").trim();
    }

    if (!nom || !telephone) {
      return new Response(
        JSON.stringify({ error: "Le nom et le numéro de téléphone / WhatsApp sont obligatoires." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Sauvegarde en base de données Neon si disponible
    try {
      const sql = requireDatabase();
      await sql`
        create table if not exists can2027_concours (
          id uuid primary key default gen_random_uuid(),
          full_name text not null,
          phone text not null,
          email text,
          city text,
          match_choice text not null,
          message text,
          created_at timestamptz not null default now()
        )
      `;

      await sql`
        insert into can2027_concours (full_name, phone, email, city, match_choice, message)
        values (${nom}, ${telephone}, ${email || null}, ${ville || null}, ${matchChoix}, ${message || null})
      `;
    } catch (dbErr) {
      console.warn("Neon DB can2027_concours insert (non bloquant):", dbErr);
    }

    // 2. Ajout au répertoire centralisé des supporters
    const [firstName, ...rest] = nom.split(/\s+/);
    await upsertSupporter({
      firstName: firstName || "Supporter",
      lastName: rest.join(" ") || "Léopards",
      phone: telephone,
      email: email || null,
      city: ville || null,
      tags: ["concours_can2027", `match_${matchChoix}`],
      note: `Concours CAN 2027 : ${matchChoix.toUpperCase()} — Ville: ${ville || "Non précisée"}${message ? ` — « ${message} »` : ""}`
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Votre participation a bien été validée ! L'équipe du Bloc Léopards vous contactera sur WhatsApp pour le tirage au sort."
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur lors de la soumission du concours CAN 2027:", error);
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
