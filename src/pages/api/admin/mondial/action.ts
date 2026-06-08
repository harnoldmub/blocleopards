import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";
import { invalidateSettings } from "../../../../lib/settings";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    const body = await request.json();
    const { action, id, status, seed, ticketsCount, groupIds, groupStatus } = body;
    const sql = requireDatabase();

    if (action === "verify") {
      if (!id || !status) {
        return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400 });
      }
      await sql`update mondial_inscriptions set verification_status = ${status}, updated_at = now() where id = ${id}`;
      const docStatus = status === "verified" ? "validated" : "refused";
      await sql`update justificatifs_identite set status = ${docStatus} where inscription_id = ${id}`;
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "verifyGroup") {
      if (!Array.isArray(groupIds) || groupIds.length === 0 || !groupStatus) {
        return new Response(JSON.stringify({ error: "Données de groupe invalides." }), { status: 400 });
      }
      await sql`update mondial_inscriptions set verification_status = ${groupStatus}, updated_at = now() where id = any(${groupIds}::int[])`;
      const docStatus = groupStatus === "verified" ? "validated" : "refused";
      await sql`update justificatifs_identite set status = ${docStatus} where inscription_id = any(${groupIds}::int[])`;
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "delete_documents") {
      // Delete documents for validated or rejected profiles (RGPD minimisation)
      const docs = await sql`
        select j.id, j.stored_filename, j.uploaded_at
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

      return new Response(JSON.stringify({ success: true, deletedCount }));
    }

    if (action === "run_draw") {
      // 1. Fetch and sort all eligible candidates (verified)
      const candidates = await sql`
        select id, email, first_name, last_name, city, state_us
        from mondial_inscriptions
        where verification_status = 'verified'
        order by id asc
      `;

      if (candidates.length === 0) {
        return new Response(JSON.stringify({ error: "Aucun candidat vérifié n'est éligible pour le tirage." }), { status: 400 });
      }

      // 2. Generate list engagement hash
      const hashInput = JSON.stringify(candidates.map(c => c.id));
      const engagementHash = crypto.createHash("sha256").update(hashInput).digest("hex");

      // 3. Perform deterministic shuffle using seed
      const activeSeed = seed || crypto.randomBytes(16).toString("hex");
      
      const shuffled = [...candidates].map(c => {
        const hash = crypto.createHash("sha256").update(c.id + activeSeed).digest("hex");
        return { ...c, hash };
      }).sort((a, b) => a.hash.localeCompare(b.hash));

      // 4. Select winners
      const count = parseInt(ticketsCount) || 500;
      const winners = shuffled.slice(0, count);
      const winnerIds = winners.map(w => w.id);

      // 5. Save settings and mark winner tickets
      await sql`update mondial_inscriptions set ticket_given_at = null`;
      if (winnerIds.length > 0) {
        await sql`update mondial_inscriptions set ticket_given_at = now() where id = any(${winnerIds}::int[])`;
      }
      await sql`insert into settings (key, value) values ('mondial_tirage_seed', ${activeSeed}) on conflict (key) do update set value = ${activeSeed}`;
      await sql`insert into settings (key, value) values ('mondial_tirage_hash', ${engagementHash}) on conflict (key) do update set value = ${engagementHash}`;
      await sql`insert into settings (key, value) values ('mondial_winners', ${JSON.stringify(winnerIds)}) on conflict (key) do update set value = ${JSON.stringify(winnerIds)}`;
      await sql`insert into settings (key, value) values ('mondial_tickets_count', ${String(count)}) on conflict (key) do update set value = ${String(count)}`;

      // Log every draw attempt — full audit trail
      await sql`
        insert into mondial_tirage_logs (seed, engagement_hash, candidates_count, winners_count, winner_ids, published)
        values (${activeSeed}, ${engagementHash}, ${candidates.length}, ${winners.length}, ${JSON.stringify(winnerIds)}, false)
      `;

      invalidateSettings();

      return new Response(JSON.stringify({ 
        success: true, 
        engagementHash, 
        seed: activeSeed, 
        totalEligible: candidates.length,
        winnersCount: winners.length 
      }));
    }

    if (action === "publish") {
      await sql`insert into settings (key, value) values ('mondial_tirage_publie', 'true') on conflict (key) do update set value = 'true'`;

      // Mark the most recent draw log as published
      const currentSeed = await sql`select value from settings where key = 'mondial_tirage_seed'`;
      if (currentSeed.length > 0) {
        await sql`
          update mondial_tirage_logs set published = true
          where seed = ${currentSeed[0].value}
          and id = (select id from mondial_tirage_logs where seed = ${currentSeed[0].value} order by ran_at desc limit 1)
        `;
      }

      invalidateSettings();
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400 });
  } catch (err) {
    console.error("Admin action API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
