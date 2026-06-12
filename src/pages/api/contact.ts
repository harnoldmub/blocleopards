import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";
import { isSpam } from "../../lib/spam";
import { upsertSupporter } from "../../lib/supporters";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    if (isSpam(formData)) return redirectTo("/contact", "success");
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

    // "Contact" crée ou enrichit une fiche supporter avec une note (non-bloquant)
    const [firstName, ...rest] = nom.split(/\s+/);
    await upsertSupporter({
      firstName,
      lastName: rest.join(" "),
      email,
      tags: ["contact"],
      note: `Contact — ${objet}${message ? ` : ${message.slice(0, 200)}` : ""}`,
    });

    return redirectTo("/contact", "success");
  } catch (error) {
    console.error("Contact submission failed", error);
    return redirectTo("/contact", "error");
  }
};
