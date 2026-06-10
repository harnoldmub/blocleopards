import { requireDatabase, hasDatabase } from "./neon";

export async function logAdminAction(
  adminUser: string,
  action: string,
  options: {
    targetType?: string;
    targetId?: string | number;
    details?: Record<string, unknown>;
    ipAddress?: string;
  } = {}
) {
  if (!hasDatabase) return;
  try {
    const sql = requireDatabase();
    await sql`
      insert into admin_audit_logs (admin_user, action, target_type, target_id, details, ip_address)
      values (
        ${adminUser},
        ${action},
        ${options.targetType ?? null},
        ${options.targetId !== undefined ? String(options.targetId) : null},
        ${JSON.stringify(options.details ?? {})},
        ${options.ipAddress ?? null}
      )
    `;
  } catch (e) {
    console.error("Audit log error:", e);
  }
}
