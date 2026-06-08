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
      // Validate/Reject single registration
      if (!id || !status) {
        return new Response(JSON.stringify({ error: "Champs requis manquants." }), { status: 400 });
      }

      await sql.begin(async (tx) => {
        await tx`
          update mondial_inscriptions
          set verification_status = ${status}, updated_at = now()
          where id = ${id}
        `;
        
        const docStatus = status === "verified" ? "validated" : "refused";
        await tx`
          update justificatifs_identite
          set status = ${docStatus}
          where inscription_id = ${id}
        `;
      });

      return new Response(JSON.stringify({ success: true }));
    }

    if (action === "verifyGroup") {
      // Batch update status for a list of IDs
      if (!Array.isArray(groupIds) || groupIds.length === 0 || !groupStatus) {
        return new Response(JSON.stringify({ error: "Données de groupe invalides." }), { status: 400 });
      }

      await sql.begin(async (tx) => {
        await tx`
          update mondial_inscriptions
          set verification_status = ${groupStatus}, updated_at = now()
          where id in ${tx(groupIds)}
        `;
        
        const docStatus = groupStatus === "verified" ? "validated" : "refused";
        await tx`
          update justificatifs_identite
          set status = ${docStatus}
          where inscription_id in ${tx(groupIds)}
        `;
      });

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
      await sql.begin(async (tx) => {
        // Reset previous winners ticket_given_at
        await tx`
          update mondial_inscriptions set ticket_given_at = null
        `;

        if (winnerIds.length > 0) {
          await tx`
            update mondial_inscriptions
            set ticket_given_at = now()
            where id in ${tx(winnerIds)}
          `;
        }

        // Save draw settings
        await tx`
          insert into settings (key, value, updated_at) values ('mondial_tirage_seed', ${activeSeed}, now())
          on conflict (key) do update set value = ${activeSeed}, updated_at = now()
        `;
        await tx`
          insert into settings (key, value, updated_at) values ('mondial_tirage_hash', ${engagementHash}, now())
          on conflict (key) do update set value = ${engagementHash}, updated_at = now()
        `;
        await tx`
          insert into settings (key, value, updated_at) values ('mondial_winners', ${JSON.stringify(winnerIds)}, now())
          on conflict (key) do update set value = ${JSON.stringify(winnerIds)}, updated_at = now()
        `;
        await tx`
          insert into settings (key, value, updated_at) values ('mondial_tickets_count', ${String(count)}, now())
          on conflict (key) do update set value = ${String(count)}, updated_at = now()
        `;
      });

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
      // Publish the results publicly
      await sql`
        insert into settings (key, value, updated_at) values ('mondial_tirage_publie', 'true', now())
        on conflict (key) do update set value = 'true', updated_at = now()
      `;
      
      invalidateSettings();
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400 });
  } catch (err) {
    console.error("Admin action API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500 });
  }
};
