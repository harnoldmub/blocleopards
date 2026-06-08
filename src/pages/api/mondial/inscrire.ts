import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const formData = await request.formData();

    const firstName = formData.get("first_name")?.toString().trim();
    const lastName = formData.get("last_name")?.toString().trim();
    const gender = formData.get("gender")?.toString().trim() || null;
    const dateOfBirth = formData.get("date_of_birth")?.toString().trim();
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const telephone = formData.get("telephone")?.toString().trim();
    const whatsapp = formData.get("whatsapp")?.toString().trim() || null;
    const country = formData.get("country")?.toString().trim() || "États-Unis";
    const city = formData.get("city")?.toString().trim();
    const stateUs = formData.get("state_us")?.toString().trim() || null;
    const isDiasporaRdc = formData.get("is_diaspora_rdc") === "true";
    const matchesVisesRaw = formData.get("matchs_vises")?.toString().trim();
    const optInMur = formData.get("opt_in_mur") === "true";
    const documentType = formData.get("document_type")?.toString().trim();
    const documentFile = formData.get("document") as File | null;

    if (!firstName || !lastName || !dateOfBirth || !email || !telephone || !city || !matchesVisesRaw || !documentType || !documentFile) {
      return new Response(JSON.stringify({ error: "Tous les champs requis doivent être remplis." }), { status: 400, headers });
    }

    let matchesVises: string[] = [];
    try {
      matchesVises = JSON.parse(matchesVisesRaw);
    } catch {
      return new Response(JSON.stringify({ error: "Format des matchs visés invalide." }), { status: 400, headers });
    }

    if (!Array.isArray(matchesVises) || matchesVises.length === 0) {
      return new Response(JSON.stringify({ error: "Au moins un match doit être sélectionné." }), { status: 400, headers });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedMimeTypes.includes(documentFile.type)) {
      return new Response(JSON.stringify({ error: "Format de document invalide. Formats autorisés : JPG, PNG, PDF." }), { status: 400, headers });
    }

    if (documentFile.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "La taille du document ne doit pas dépasser 5 Mo." }), { status: 400, headers });
    }

    const sql = requireDatabase();

    // Store document securely
    const buffer = Buffer.from(await documentFile.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const docUuid = crypto.randomUUID();
    const ext = path.extname(documentFile.name) || (documentFile.type === "application/pdf" ? ".pdf" : ".jpg");
    const storedFilename = `${docUuid}${ext}`;
    const now = new Date();
    const privateDir = path.join(process.cwd(), "private/justificatifs", now.getFullYear().toString(), (now.getMonth() + 1).toString().padStart(2, "0"));
    fs.mkdirSync(privateDir, { recursive: true });
    fs.writeFileSync(path.join(privateDir, storedFilename), buffer);

    // Anti-fraud checks
    const antiFraudFlags: string[] = [];

    const emailDup = await sql`select id from mondial_inscriptions where lower(email) = ${email}`;
    if (emailDup.length > 0) {
      try { fs.unlinkSync(path.join(privateDir, storedFilename)); } catch {}
      return new Response(JSON.stringify({ error: "Une inscription avec cet email existe déjà." }), { status: 409, headers });
    }

    const phoneDup = await sql`select id from mondial_inscriptions where phone = ${telephone}`;
    if (phoneDup.length > 0) antiFraudFlags.push("duplicate_phone");

    const ipDup = await sql`select id from mondial_inscriptions where ip_address = ${clientAddress}`;
    if (ipDup.length >= 3) antiFraudFlags.push("multiple_ip_registrations");

    const docDup = await sql`select id from justificatifs_identite where checksum = ${checksum} and deleted_at is null`;
    if (docDup.length > 0) antiFraudFlags.push("duplicate_document_file");

    const verificationStatus = antiFraudFlags.length > 0 ? "flagged" : "pending";

    const [inscription] = await sql`
      insert into mondial_inscriptions (
        first_name, last_name, gender, date_of_birth, email, phone, whatsapp,
        country, city, state_us, is_diaspora_rdc, matchs_vises, opt_in_mur,
        ip_address, user_agent, verification_status, anti_fraud_flags
      ) values (
        ${firstName}, ${lastName}, ${gender}, ${dateOfBirth}, ${email}, ${telephone}, ${whatsapp},
        ${country}, ${city}, ${stateUs}, ${isDiasporaRdc}, ${JSON.stringify(matchesVises)}, ${optInMur},
        ${clientAddress}, ${request.headers.get("user-agent") || ""}, ${verificationStatus}, ${JSON.stringify(antiFraudFlags)}
      ) returning id
    `;
    await sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, status
      ) values (
        ${inscription.id}, ${documentType}, ${documentFile.name}, ${storedFilename},
        ${documentFile.type}, ${documentFile.size}, ${checksum}, 'pending'
      )
    `;

    const ticketNumber = `BL-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    return new Response(JSON.stringify({ success: true, ticketNumber }), { status: 200, headers });
  } catch (err) {
    console.error("Mondial inscription API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur. Réessaie dans quelques instants." }), { status: 500, headers });
  }
};
