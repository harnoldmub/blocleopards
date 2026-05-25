import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const prenom = formValue(formData, "prenom");
    const nom = formValue(formData, "nom");
    const email = formValue(formData, "email").toLowerCase();
    const telephone = formValue(formData, "telephone");
    const pays = formValue(formData, "pays");
    const ville = formValue(formData, "ville");
    const role = formValue(formData, "role");
    const canal = formValue(formData, "canal");
    const disponibilite = formValue(formData, "disponibilite");
    const motivation = formValue(formData, "motivation");
    const charteAccepted = formData.get("charte") === "on";
    const newsletterOptIn = formData.get("newsletter") === "on";

    if (!prenom || !nom || !email || !ville || !role || !charteAccepted) {
      return redirectTo("/rejoindre", "missing");
    }

    const sql = requireDatabase();
    await sql`
      insert into adhesions (
        prenom,
        nom,
        email,
        telephone,
        pays,
        ville,
        role,
        canal,
        disponibilite,
        motivation,
        charte_accepted,
        newsletter_opt_in
      )
      values (
        ${prenom},
        ${nom},
        ${email},
        ${telephone || null},
        ${pays || null},
        ${ville},
        ${role},
        ${canal || null},
        ${disponibilite || null},
        ${motivation || null},
        ${charteAccepted},
        ${newsletterOptIn}
      )
    `;

    return redirectTo("/rejoindre", "success");
  } catch (error) {
    console.error("Adhesion submission failed", error);
    return redirectTo("/rejoindre", "error");
  }
};
