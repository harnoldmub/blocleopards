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
    const stateUs = formData.get("state_us")?.toString().trim() || "";
    const isDiasporaRdc = formData.get("is_diaspora_rdc") === "true";
    const matchesVisesRaw = formData.get("matchs_vises")?.toString().trim();
    const optInMur = formData.get("opt_in_mur") === "true";
    const documentType = formData.get("document_type")?.toString().trim();
    const documentFile = formData.get("document") as File | null;
    const portraitFile = formData.get("portrait") as File | null;

    if (!firstName || !lastName || !dateOfBirth || !email || !telephone || !city || !matchesVisesRaw || !documentType || !documentFile || !portraitFile) {
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

    if (!["PASSPORT", "DRIVER_LICENSE"].includes(documentType)) {
      return new Response(JSON.stringify({ error: "Type de document invalide." }), { status: 400, headers });
    }

    const allowedDocumentMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedDocumentMimeTypes.includes(documentFile.type)) {
      return new Response(JSON.stringify({ error: "Format de document invalide. Formats autorisés : JPG, PNG, PDF." }), { status: 400, headers });
    }

    if (documentFile.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "La taille du document ne doit pas dépasser 5 Mo." }), { status: 400, headers });
    }

    const allowedPortraitMimeTypes = ["image/jpeg", "image/png"];
    if (!allowedPortraitMimeTypes.includes(portraitFile.type)) {
      return new Response(JSON.stringify({ error: "Format de photo portrait invalide. Formats autorisés : JPG, PNG." }), { status: 400, headers });
    }

    if (portraitFile.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "La taille de la photo portrait ne doit pas dépasser 5 Mo." }), { status: 400, headers });
    }

    const sql = requireDatabase();

    const now = new Date();
    const privateDir = path.join(process.cwd(), "private/justificatifs", now.getFullYear().toString(), (now.getMonth() + 1).toString().padStart(2, "0"));
    fs.mkdirSync(privateDir, { recursive: true });

    const prepareUpload = async (file: File) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
      const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".jpg");
      const storedFilename = `${crypto.randomUUID()}${ext}`;
      return { buffer, checksum, storedFilename };
    };

    const documentUpload = await prepareUpload(documentFile);
    const portraitUpload = await prepareUpload(portraitFile);

    // Anti-fraud checks
    const antiFraudFlags: string[] = [];

    const emailDup = await sql`select id from mondial_inscriptions where lower(email) = ${email}`;
    if (emailDup.length > 0) {
      return new Response(JSON.stringify({ error: "Une inscription avec cet email existe déjà." }), { status: 409, headers });
    }

    const phoneDup = await sql`select id from mondial_inscriptions where phone = ${telephone}`;
    if (phoneDup.length > 0) antiFraudFlags.push("duplicate_phone");

    const ipDup = await sql`select id from mondial_inscriptions where ip_address = ${clientAddress}`;
    if (ipDup.length >= 3) antiFraudFlags.push("multiple_ip_registrations");

    const docDup = await sql`select id from justificatifs_identite where checksum = ${documentUpload.checksum} and deleted_at is null`;
    if (docDup.length > 0) antiFraudFlags.push("duplicate_document_file");

    const portraitDup = await sql`select id from justificatifs_identite where checksum = ${portraitUpload.checksum} and deleted_at is null`;
    if (portraitDup.length > 0) antiFraudFlags.push("duplicate_portrait_file");

    const verificationStatus = antiFraudFlags.length > 0 ? "flagged" : "pending";
    const ticketNumber = `BL-2026-${crypto.randomInt(100000, 1000000)}`;

    const [inscription] = await sql`
      insert into mondial_inscriptions (
        first_name, last_name, gender, date_of_birth, email, phone, whatsapp,
        country, city, state_us, is_diaspora_rdc, matchs_vises, opt_in_mur,
        ip_address, user_agent, verification_status, anti_fraud_flags, ticket_number
      ) values (
        ${firstName}, ${lastName}, ${gender}, ${dateOfBirth}, ${email}, ${telephone}, ${whatsapp},
        ${country}, ${city}, ${stateUs}, ${isDiasporaRdc}, ${JSON.stringify(matchesVises)}, ${optInMur},
        ${clientAddress}, ${request.headers.get("user-agent") || ""}, ${verificationStatus}, ${JSON.stringify(antiFraudFlags)}, ${ticketNumber}
      ) returning id
    `;

    fs.writeFileSync(path.join(privateDir, documentUpload.storedFilename), documentUpload.buffer);
    fs.writeFileSync(path.join(privateDir, portraitUpload.storedFilename), portraitUpload.buffer);

    await sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, status
      ) values (
        ${inscription.id}, ${documentType}, ${documentFile.name}, ${documentUpload.storedFilename},
        ${documentFile.type}, ${documentFile.size}, ${documentUpload.checksum}, 'pending'
      )
    `;

    await sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, status
      ) values (
        ${inscription.id}, 'PHOTO', ${portraitFile.name}, ${portraitUpload.storedFilename},
        ${portraitFile.type}, ${portraitFile.size}, ${portraitUpload.checksum}, 'pending'
      )
    `;

    return new Response(JSON.stringify({ success: true, ticketNumber }), { status: 200, headers });
  } catch (err) {
    console.error("Mondial inscription API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur. Réessaie dans quelques instants." }), { status: 500, headers });
  }
};
