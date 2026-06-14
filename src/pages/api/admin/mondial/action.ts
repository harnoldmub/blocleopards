import type { APIRoute } from "astro";
import { isAdminAuthed, isSuperAdmin, getSessionUser } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";
import { invalidateSettings } from "../../../../lib/settings";
import { logAdminAction } from "../../../../lib/audit";
import { randomInt } from "crypto";
import fs from "fs";
import path from "path";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const adminUser = getSessionUser(cookies);

  try {
    const body = await request.json();
    const { action, id, status, ticketsCount, groupIds, groupStatus, matchKey } = body;
    const sql = requireDatabase();

    if (action === "verify") {
      if (!id || !status) {
        return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400 });
      }
      const [ins] = await sql`select first_name, last_name from mondial_inscriptions where id = ${id}`;
      await sql`update mondial_inscriptions set verification_status = ${status}, updated_at = now() where id = ${id}`;
      const docStatus = status === "verified" ? "validated" : "refused";
      await sql`update justificatifs_identite set status = ${docStatus} where inscription_id = ${id}`;
      await logAdminAction(adminUser, status === "verified" ? "verify_inscription" : "reject_inscription", {
        targetType: "inscription", targetId: id,
        details: { name: ins ? `${ins.first_name} ${ins.last_name}` : id },
        ipAddress: clientAddress,
      });
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "verifyGroup") {
      if (!Array.isArray(groupIds) || groupIds.length === 0 || !groupStatus) {
        return new Response(JSON.stringify({ error: "Données de groupe invalides." }), { status: 400 });
      }
      await sql`update mondial_inscriptions set verification_status = ${groupStatus}, updated_at = now() where id = any(${groupIds}::int[])`;
      const docStatus = groupStatus === "verified" ? "validated" : "refused";
      await sql`update justificatifs_identite set status = ${docStatus} where inscription_id = any(${groupIds}::int[])`;
      await logAdminAction(adminUser, groupStatus === "verified" ? "verify_group" : "reject_group", {
        details: { count: groupIds.length, ids: groupIds },
        ipAddress: clientAddress,
      });
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "delete_documents") {
      // Delete documents for validated or rejected profiles (RGPD minimisation)
      const docs = await sql`
        select j.id, j.stored_filename, coalesce(j.uploaded_at, j.created_at) as uploaded_at
        from justificatifs_identite j
        join mondial_inscriptions m on m.id = j.inscription_id
        where j.deleted_at is null 
        and m.verification_status in ('verified', 'rejected')
      `;

      let deletedCount = 0;
      await sql.begin(async (tx) => {
        for (const doc of docs) {
          const uploadedDate = new Date(doc.uploaded_at);
          const year = uploadedDate.getFullYear().toString();
          const month = (uploadedDate.getMonth() + 1).toString().padStart(2, "0");
          const filePath = path.join(process.cwd(), "private/justificatifs", year, month, doc.stored_filename);
          
          // Delete file physically
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            console.error(`Could not delete file ${filePath}:`, e);
          }

          // Mark as deleted in DB
          await tx`
            update justificatifs_identite
            set deleted_at = now()
            where id = ${doc.id}
          `;
          deletedCount++;
        }
      });

      await logAdminAction(adminUser, "delete_documents_rgpd", { details: { deletedCount }, ipAddress: clientAddress });
      return new Response(JSON.stringify({ success: true, deletedCount }));
    }

    if (action === "run_draw") {
      if (!matchKey) {
        return new Response(JSON.stringify({ error: "Choisissez un match avant de lancer le tirage." }), { status: 400 });
      }

      const quota = parseInt(ticketsCount, 10);
      if (!Number.isFinite(quota) || quota <= 0) {
        return new Response(JSON.stringify({ error: "Indiquez un quota de gagnants valide." }), { status: 400 });
      }

      // 1. Fetch eligible candidates for the selected match
      const candidates = await sql`
        select id, email, first_name, last_name, city, state_us, matchs_vises
        from mondial_inscriptions
        where verification_status = 'verified'
        and programme = 'tirage_usa'
        and matchs_vises @> ${JSON.stringify([matchKey])}::jsonb
        order by id asc
      `;

      if (candidates.length === 0) {
        return new Response(JSON.stringify({ error: "Aucun candidat vérifié n'est éligible pour ce match." }), { status: 400 });
      }

      // 2. Random shuffle with server-side crypto randomness
      const shuffled = [...candidates];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 3. Select winners
      const count = Math.min(quota, shuffled.length);
      const winners = shuffled.slice(0, count);
      const winnerIds = winners.map(w => w.id);

      // 4. Save settings and mark winners for this match only
      await sql`
        update mondial_inscriptions
        set ticket_given_at = null, selected_match_key = null
        where selected_match_key = ${matchKey}
      `;
      if (winnerIds.length > 0) {
        await sql`
          update mondial_inscriptions
          set ticket_given_at = now(), selected_match_key = ${matchKey}
          where id = any(${winnerIds}::int[])
        `;
      }
      await sql`insert into settings (key, value) values ('mondial_winners', ${JSON.stringify(winnerIds)}) on conflict (key) do update set value = ${JSON.stringify(winnerIds)}`;
      await sql`insert into settings (key, value) values ('mondial_tickets_count', ${String(count)}) on conflict (key) do update set value = ${String(count)}`;

      // Log every draw attempt — internal/public history
      await sql`
        insert into mondial_tirage_logs (match_key, seed, engagement_hash, candidates_count, winners_count, winner_ids, published)
        values (${matchKey}, 'random', 'simple-random-draw', ${candidates.length}, ${winners.length}, ${JSON.stringify(winnerIds)}, false)
      `;

      invalidateSettings();

      await logAdminAction(adminUser, "run_draw", {
        details: { matchKey, totalEligible: candidates.length, winnersCount: winners.length },
        ipAddress: clientAddress,
      });
      return new Response(JSON.stringify({
        success: true,
        matchKey,
        totalEligible: candidates.length,
        winnersCount: winners.length
      }));
    }

    if (action === "publish") {
      if (!matchKey) {
        return new Response(JSON.stringify({ error: "Choisissez le match à publier." }), { status: 400 });
      }

      await sql`insert into settings (key, value) values ('mondial_tirage_publie', 'true') on conflict (key) do update set value = 'true'`;

      await sql`
        update mondial_tirage_logs
        set published = true
        where id = (
          select id
          from mondial_tirage_logs
          where match_key = ${matchKey}
          order by ran_at desc
          limit 1
        )
      `;

      await logAdminAction(adminUser, "publish_draw", { details: { matchKey }, ipAddress: clientAddress });
      invalidateSettings();
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "delete_inscription") {
      if (!isSuperAdmin(cookies)) {
        return new Response(JSON.stringify({ error: "Réservé au super admin." }), { status: 403 });
      }
      if (!id) {
        return new Response(JSON.stringify({ error: "ID manquant." }), { status: 400 });
      }
      const docs = await sql`
        select stored_filename, coalesce(uploaded_at, created_at) as uploaded_at
        from justificatifs_identite
        where inscription_id = ${id} and deleted_at is null
      `;
      for (const doc of docs) {
        const d = new Date(doc.uploaded_at);
        const filePath = path.join(process.cwd(), "private/justificatifs", d.getFullYear().toString(), (d.getMonth() + 1).toString().padStart(2, "0"), doc.stored_filename);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      }
      const [ins] = await sql`select first_name, last_name, email from mondial_inscriptions where id = ${id}`;
      await sql`delete from mondial_inscriptions where id = ${id}`;
      await logAdminAction(adminUser, "delete_inscription", {
        targetType: "inscription", targetId: id,
        details: ins ? { name: `${ins.first_name} ${ins.last_name}`, email: ins.email } : {},
        ipAddress: clientAddress,
      });
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400 });
  } catch (err) {
    console.error("Admin action API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
