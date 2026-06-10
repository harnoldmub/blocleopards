import type { APIRoute } from "astro";
import { isAdminAuthed, isSuperAdmin } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdminAuthed(cookies) || !isSuperAdmin(cookies)) {
    return new Response(JSON.stringify({ error: "Accès refusé." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const filterUser = url.searchParams.get("user") ?? "";
  const filterAction = url.searchParams.get("action") ?? "";

  const sql = requireDatabase();

  const logs = await sql`
    select id, admin_user, action, target_type, target_id, details, ip_address, created_at
    from admin_audit_logs
    where
      (${filterUser} = '' or admin_user = ${filterUser})
      and (${filterAction} = '' or action = ${filterAction})
    order by created_at desc
    limit ${limit} offset ${offset}
  `;

  const [{ total }] = await sql`
    select count(*)::integer as total from admin_audit_logs
    where
      (${filterUser} = '' or admin_user = ${filterUser})
      and (${filterAction} = '' or action = ${filterAction})
  `;

  const users = await sql`select distinct admin_user from admin_audit_logs order by admin_user`;
  const actions = await sql`select distinct action from admin_audit_logs order by action`;

  return new Response(JSON.stringify({ logs, total, users: users.map((r: any) => r.admin_user), actions: actions.map((r: any) => r.action) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
