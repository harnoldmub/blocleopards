import type { APIRoute } from "astro";
import { checkAdminPassword } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !checkAdminPassword(password)) {
      return new Response(JSON.stringify({ error: "Mot de passe incorrect." }), { status: 401, headers });
    }

    const token = import.meta.env.ADMIN_SESSION_TOKEN;
    cookies.set("admin_session", token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete("admin_session", { path: "/" });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
