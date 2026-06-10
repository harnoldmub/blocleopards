import type { APIRoute } from "astro";
import { checkAdminPassword, verifyPassword, setSessionCookies, clearSessionCookies, getSessionUser } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { logAdminAction } from "../../../lib/audit";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Identifiant et mot de passe requis." }), { status: 400, headers });
    }

    // Super admin via env var — username must be "admin"
    if (username === "admin" && checkAdminPassword(password)) {
      setSessionCookies(cookies, "super", ["*"], "admin");
      await logAdminAction("admin", "login", { ipAddress: clientAddress });
      return new Response(JSON.stringify({ success: true, role: "super" }), { status: 200, headers });
    }

    // Check DB roles — username = role_name
    try {
      const sql = requireDatabase();
      const [role] = await sql`SELECT role_name, label, password_hash, permissions FROM admin_roles WHERE role_name = ${username}`;
      if (role && verifyPassword(password, role.password_hash)) {
        setSessionCookies(cookies, role.role_name, role.permissions, role.role_name);
        await logAdminAction(role.role_name, "login", { details: { label: role.label }, ipAddress: clientAddress });
        return new Response(JSON.stringify({ success: true, role: role.role_name }), { status: 200, headers });
      }
    } catch {
      // DB unavailable — only env var auth works
    }

    await logAdminAction(username, "login_failed", { ipAddress: clientAddress });
    return new Response(JSON.stringify({ error: "Identifiant ou mot de passe incorrect." }), { status: 401, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers });
  }
};

export const DELETE: APIRoute = async ({ cookies, clientAddress }) => {
  const user = getSessionUser(cookies);
  clearSessionCookies(cookies);
  await logAdminAction(user, "logout", { ipAddress: clientAddress });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
