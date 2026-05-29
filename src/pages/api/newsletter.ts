import type { APIRoute } from "astro";
import { formValue, redirectTo } from "../../lib/forms";
import { requireDatabase } from "../../lib/neon";
import { isSpam } from "../../lib/spam";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    if (isSpam(formData)) return redirectTo("/", "newsletter-success");
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
