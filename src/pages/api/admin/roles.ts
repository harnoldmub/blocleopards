import type { APIRoute } from "astro";
import { isAdminAuthed, isSuperAdmin, hashPassword, getSessionUser } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";
import { logAdminAction } from "../../../lib/audit";

export const prerender = false;

function forbidden() {
  return new Response(JSON.stringify({ error: "Accès refusé." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies) || !isSuperAdmin(cookies)) return forbidden();
  const sql = requireDatabase();
  const roles = await sql`
    SELECT id, role_name, label, permissions, created_at
    FROM admin_roles
    ORDER BY created_at ASC
  `;
  return new Response(JSON.stringify(roles), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminAuthed(cookies) || !isSuperAdmin(cookies)) return forbidden();
  const headers = { "Content-Type": "application/json" };
  const { role_name, label, password, permissions } = await request.json();

  if (!role_name || !label || !password || !Array.isArray(permissions)) {
    return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400, headers });
  }
  if (role_name === "super") {
    return new Response(JSON.stringify({ error: "Le nom 'super' est réservé." }), { status: 400, headers });
  }

  const sql = requireDatabase();
  const password_hash = hashPassword(password);
  try {
    const [row] = await sql`
      INSERT INTO admin_roles (role_name, label, password_hash, permissions)
      VALUES (${role_name.toLowerCase().trim()}, ${label.trim()}, ${password_hash}, ${permissions})
      RETURNING id, role_name, label, permissions
    `;
    await logAdminAction(getSessionUser(cookies), "create_role", {
      targetType: "role", targetId: row.id,
      details: { role_name: row.role_name, label: row.label, permissions },
      ipAddress: clientAddress,
    });
    return new Response(JSON.stringify(row), { status: 201, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Ce nom de rôle existe déjà." }), { status: 409, headers });
  }
};

export const PUT: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminAuthed(cookies) || !isSuperAdmin(cookies)) return forbidden();
  const headers = { "Content-Type": "application/json" };
  const { id, label, password, permissions } = await request.json();

  if (!id || !label || !Array.isArray(permissions)) {
    return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400, headers });
  }

  const sql = requireDatabase();
  const [existing] = await sql`SELECT role_name FROM admin_roles WHERE id = ${id}`;

  if (password) {
    const password_hash = hashPassword(password);
    await sql`
      UPDATE admin_roles
      SET label = ${label.trim()}, password_hash = ${password_hash}, permissions = ${permissions}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE admin_roles
      SET label = ${label.trim()}, permissions = ${permissions}
      WHERE id = ${id}
    `;
  }

  await logAdminAction(getSessionUser(cookies), "update_role", {
    targetType: "role", targetId: id,
    details: { role_name: existing?.role_name, label, password_changed: Boolean(password), permissions },
    ipAddress: clientAddress,
  });
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};

export const DELETE: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminAuthed(cookies) || !isSuperAdmin(cookies)) return forbidden();
  const headers = { "Content-Type": "application/json" };
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: "ID requis." }), { status: 400, headers });

  const sql = requireDatabase();
  const [existing] = await sql`SELECT role_name, label FROM admin_roles WHERE id = ${id}`;
  await sql`DELETE FROM admin_roles WHERE id = ${id}`;
  await logAdminAction(getSessionUser(cookies), "delete_role", {
    targetType: "role", targetId: id,
    details: existing ? { role_name: existing.role_name, label: existing.label } : {},
    ipAddress: clientAddress,
  });
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
