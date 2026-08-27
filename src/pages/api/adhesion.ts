import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";
import { isSpam } from "../../lib/spam";
import { upsertSupporter } from "../../lib/supporters";
import { verifyTurnstile } from "../../lib/turnstile";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const formData = await request.formData();
    if (isSpam(formData)) return redirectTo("/rejoindre", "success");
    const captchaOk = await verifyTurnstile(formValue(formData, "cf-turnstile-response"), clientAddress);
    if (!captchaOk) return redirectTo("/rejoindre", "captcha");
    const prenom = formValue(formData, "prenom");
    const nom = formValue(formData, "nom");
    const email = formValue(formData, "email").toLowerCase();
    const telephone = formValue(formData, "telephone");
    const date_naissance = formValue(formData, "date_naissance");
    const pays = formValue(formData, "pays");
    const ville = formValue(formData, "ville");
    const role = formValue(formData, "role");
    const canal = formValue(formData, "canal");
    const disponibilite = formValue(formData, "disponibilite");
    const motivation = formValue(formData, "motivation");
    const portfolio = formValue(formData, "portfolio");
    const charteAccepted = formData.get("charte") === "on";
    const newsletterOptIn = formData.get("newsletter") === "on";
    const isAdult = formData.get("is_adult") === "on";
    const hasPassport = formData.get("has_passport") === "on";

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
        date_naissance,
        pays,
        ville,
        role,
        canal,
        disponibilite,
        motivation,
        portfolio,
        charte_accepted,
        newsletter_opt_in,
        is_adult,
        has_passport
      )
      values (
        ${prenom},
        ${nom},
        ${email},
        ${telephone || null},
        ${date_naissance || null},
        ${pays || null},
        ${ville},
        ${role},
        ${canal || null},
        ${disponibilite || null},
        ${motivation || null},
        ${portfolio || null},
        ${charteAccepted},
        ${newsletterOptIn},
        ${isAdult},
        ${hasPassport}
      )
    `;

    // "Rejoindre le Bloc" ajoute la personne dans la base supporters (non-bloquant)
    await upsertSupporter({
      firstName: prenom,
      lastName: nom,
      email,
      phone: telephone || null,
      city: ville,
      country: pays || null,
      tags: ["adhesion"],
    });

    return redirectTo("/rejoindre", "success");
  } catch (error) {
    console.error("Adhesion submission failed", error);
    return redirectTo("/rejoindre", "error");
  }
};
