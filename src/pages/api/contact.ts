import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const nom = formValue(formData, "nom");
    const email = formValue(formData, "email").toLowerCase();
    const objet = formValue(formData, "objet");
    const message = formValue(formData, "message");

    if (!nom || !email || !objet) {
      return redirectTo("/contact", "missing");
    }

    const sql = requireDatabase();
    await sql`
      insert into contact_messages (nom, email, objet, message)
      values (${nom}, ${email}, ${objet}, ${message || null})
    `;

    return redirectTo("/contact", "success");
  } catch (error) {
    console.error("Contact submission failed", error);
    return redirectTo("/contact", "error");
  }
};
