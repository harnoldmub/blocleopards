import type { APIRoute } from "astro";
import { checkAdminPassword, verifyPassword, setSessionCookies, clearSessionCookies } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return new Response(JSON.stringify({ error: "Mot de passe requis." }), { status: 400, headers });
    }

    // Super admin via env var
    if (checkAdminPassword(password)) {
      setSessionCookies(cookies, "super", ["*"]);
      return new Response(JSON.stringify({ success: true, role: "super" }), { status: 200, headers });
    }

    // Check DB roles
    try {
      const sql = requireDatabase();
      const roles = await sql`SELECT role_name, password_hash, permissions FROM admin_roles`;
      for (const role of roles) {
        if (verifyPassword(password, role.password_hash)) {
          setSessionCookies(cookies, role.role_name, role.permissions);
          return new Response(JSON.stringify({ success: true, role: role.role_name }), { status: 200, headers });
        }
      }
    } catch {
      // DB unavailable — only env var auth works
    }

    return new Response(JSON.stringify({ error: "Mot de passe incorrect." }), { status: 401, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  clearSessionCookies(cookies);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
