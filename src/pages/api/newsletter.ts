import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";
import { isSpam } from "../../lib/spam";
import { verifyTurnstile } from "../../lib/turnstile";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const formData = await request.formData();
    if (isSpam(formData)) return redirectTo("/", "newsletter-success");
    const captchaOk = await verifyTurnstile(formValue(formData, "cf-turnstile-response"), clientAddress);
    if (!captchaOk) return redirectTo("/", "newsletter-captcha");
    const email = formValue(formData, "email").toLowerCase();

    if (!email) {
      return redirectTo("/", "missing");
    }

    const sql = requireDatabase();
    await sql`
      insert into newsletter_subscriptions (email)
      values (${email})
      on conflict (email) do update set updated_at = now()
    `;

    return redirectTo("/", "newsletter-success");
  } catch (error) {
    console.error("Newsletter submission failed", error);
    return redirectTo("/", "newsletter-error");
  }
};
