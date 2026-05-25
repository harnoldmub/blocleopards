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
    const ville = formValue(formData, "ville");
    const motivation = formValue(formData, "motivation");
    const charteAccepted = formData.get("charte") === "on";

    if (!prenom || !nom || !email || !ville || !charteAccepted) {
      return redirectTo("/rejoindre", "missing");
    }

    const sql = requireDatabase();
    await sql`
      insert into adhesions (prenom, nom, email, ville, motivation, charte_accepted)
      values (${prenom}, ${nom}, ${email}, ${ville}, ${motivation || null}, ${charteAccepted})
    `;

    return redirectTo("/rejoindre", "success");
  } catch (error) {
    console.error("Adhesion submission failed", error);
    return redirectTo("/rejoindre", "error");
  }
};
