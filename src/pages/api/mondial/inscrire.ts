import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";
import { sendInscriptionConfirmation } from "../../../lib/email";
import { upsertSupporter } from "../../../lib/supporters";
import { hasObjectStorage, putObject, buildStorageKey } from "../../../lib/storage";
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

    if (!firstName || !lastName || !dateOfBirth || !email || !city || !matchesVisesRaw || !documentType || !documentFile || !portraitFile) {
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

    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (isNaN(dob.getTime()) || age < 18) {
      return new Response(JSON.stringify({ error: "Vous devez avoir au moins 18 ans pour vous inscrire." }), { status: 400, headers });
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

    const prepareUpload = async (file: File) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : (file.type === "application/pdf" ? ".pdf" : ".jpg");
      const storedFilename = `${crypto.randomUUID()}${ext}`;
      return { buffer, checksum, storedFilename };
    };

    const documentUpload = await prepareUpload(documentFile);
    const portraitUpload = await prepareUpload(portraitFile);

    // Téléverse vers le bucket S3 si configuré ; sinon fallback bytea en DB.
    const storeFile = async (up: { buffer: Buffer; storedFilename: string }, mime: string) => {
      if (!hasObjectStorage) return { storageKey: null as string | null, fileData: up.buffer as Buffer | null };
      try {
        const key = buildStorageKey("mondial", up.storedFilename);
        await putObject(key, up.buffer, mime);
        return { storageKey: key, fileData: null as Buffer | null };
      } catch (err) {
        console.error("Upload S3 échoué, fallback DB:", err);
        return { storageKey: null as string | null, fileData: up.buffer as Buffer | null };
      }
    };

    const documentStored = await storeFile(documentUpload, documentFile.type);
    const portraitStored = await storeFile(portraitUpload, portraitFile.type);

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

    await sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, storage_key, file_data, status
      ) values (
        ${inscription.id}, ${documentType}, ${documentFile.name}, ${documentUpload.storedFilename},
        ${documentFile.type}, ${documentFile.size}, ${documentUpload.checksum},
        ${documentStored.storageKey}, ${documentStored.fileData}, 'pending'
      )
    `;

    await sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, storage_key, file_data, status
      ) values (
        ${inscription.id}, 'PHOTO', ${portraitFile.name}, ${portraitUpload.storedFilename},
        ${portraitFile.type}, ${portraitFile.size}, ${portraitUpload.checksum},
        ${portraitStored.storageKey}, ${portraitStored.fileData}, 'pending'
      )
    `;

    // "Gagne ton billet" crée une demande de billet dans la base supporters,
    // avec un tag par match visé (liste de participants par match)
    await upsertSupporter({
      firstName,
      lastName,
      email,
      phone: telephone || null,
      city,
      country,
      tags: ["mondial-2026", ...matchesVises.map((m) => `billet-${m}`)],
      note: `Demande de billet Mondial 2026 — dossier ${ticketNumber}`,
    });

    // Envoi email de confirmation (non-bloquant)
    sendInscriptionConfirmation({
      to: email,
      firstName,
      lastName,
      ticketNumber,
      matchesVises,
    });

    return new Response(JSON.stringify({ success: true, ticketNumber }), { status: 200, headers });
  } catch (err) {
    console.error("Mondial inscription API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur. Réessaie dans quelques instants." }), { status: 500, headers });
  }
};
