import type { APIRoute } from "astro";
import { requireDatabase } from "../../../lib/neon";
import { upsertSupporter } from "../../../lib/supporters";
import { sendGuadalajaraConfirmation } from "../../../lib/email";
import { hasObjectStorage, putObject, buildStorageKey } from "../../../lib/storage";
import crypto from "crypto";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const formData = await request.formData();

    const firstName = formData.get("first_name")?.toString().trim();
    const lastName = formData.get("last_name")?.toString().trim();
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const phone = formData.get("phone")?.toString().trim() || null;
    const whatsapp = formData.get("whatsapp")?.toString().trim() || phone;
    const country = formData.get("country")?.toString().trim() || null;
    const city = formData.get("city")?.toString().trim() || null;
    const transportType = formData.get("transport_type")?.toString().trim() || null;
    const needsLodging = formData.get("needs_lodging") === "true";
    const identityFile = formData.get("identity") as File | null;
    const transportFile = formData.get("transport_proof") as File | null;

    if (!firstName || !lastName || !email || !identityFile || !transportFile) {
      return new Response(JSON.stringify({ error: "Tous les champs obligatoires doivent être remplis (identité, pièce d'identité et preuve de transport)." }), { status: 400, headers });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Adresse email invalide." }), { status: 400, headers });
    }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    for (const [label, file] of [["pièce d'identité", identityFile], ["preuve de transport", transportFile]] as const) {
      if (!allowedTypes.includes(file.type)) {
        return new Response(JSON.stringify({ error: `Format invalide pour la ${label}. Formats autorisés : JPG, PNG, PDF.` }), { status: 400, headers });
      }
      if (file.size > 8 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: `Le fichier ${label} ne doit pas dépasser 8 Mo.` }), { status: 400, headers });
      }
    }

    const sql = requireDatabase();

    const prepareUpload = async (file: File) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : (file.type === "application/pdf" ? ".pdf" : ".jpg");
      const storedFilename = `${crypto.randomUUID()}${ext}`;
      return { buffer, checksum, storedFilename };
    };

    const identityUpload = await prepareUpload(identityFile);
    const transportUpload = await prepareUpload(transportFile);

    // Téléverse vers le bucket S3 si configuré ; sinon fallback bytea en DB.
    const storeFile = async (up: { buffer: Buffer; checksum: string; storedFilename: string }, mime: string) => {
      if (!hasObjectStorage) return { storageKey: null as string | null, fileData: up.buffer as Buffer | null };
      try {
        const key = buildStorageKey("guadalajara", up.storedFilename);
        await putObject(key, up.buffer, mime);
        return { storageKey: key, fileData: null as Buffer | null };
      } catch (err) {
        console.error("Upload S3 échoué, fallback DB:", err);
        return { storageKey: null as string | null, fileData: up.buffer as Buffer | null };
      }
    };

    const identityStored = await storeFile(identityUpload, identityFile.type);
    const transportStored = await storeFile(transportUpload, transportFile.type);

    const antiFraudFlags: string[] = [];

    // Table unifiée : une demande Guadalajara = une inscription Mondial (programme Ministère)
    const emailDup = await sql`select id from mondial_inscriptions where lower(email) = ${email}`;
    if (emailDup.length > 0) {
      return new Response(JSON.stringify({ error: "Une demande avec cet email existe déjà." }), { status: 409, headers });
    }

    const idDup = await sql`select id from justificatifs_identite where checksum = ${identityUpload.checksum} and deleted_at is null`;
    if (idDup.length > 0) antiFraudFlags.push("duplicate_identity_file");

    const verificationStatus = antiFraudFlags.length > 0 ? "flagged" : "pending";
    const reference = `GUAD-2026-${crypto.randomInt(100000, 1000000)}`;

    const [demande] = await sql`
      insert into mondial_inscriptions (
        first_name, last_name, email, phone, whatsapp, country, city,
        programme, matchs_vises, transport_type, needs_lodging,
        verification_status, anti_fraud_flags, ticket_number,
        ip_address, user_agent
      ) values (
        ${firstName}, ${lastName}, ${email}, ${phone}, ${whatsapp}, ${country}, ${city},
        'ministere_guadalajara', '["guadalajara"]'::jsonb, ${transportType}, ${needsLodging},
        ${verificationStatus}, ${JSON.stringify(antiFraudFlags)}, ${reference},
        ${clientAddress}, ${request.headers.get("user-agent") || ""}
      ) returning id
    `;

    const insertFile = (type: string, file: File, up: { checksum: string; storedFilename: string }, stored: { storageKey: string | null; fileData: Buffer | null }) => sql`
      insert into justificatifs_identite (
        inscription_id, type_document, original_filename, stored_filename,
        mime_type, size, checksum, storage_key, file_data, status
      ) values (
        ${demande.id}, ${type}, ${file.name}, ${up.storedFilename},
        ${file.type}, ${file.size}, ${up.checksum}, ${stored.storageKey}, ${stored.fileData}, 'pending'
      )
    `;

    await insertFile("PIECE_IDENTITE", identityFile, identityUpload, identityStored);
    await insertFile("PREUVE_TRANSPORT", transportFile, transportUpload, transportStored);

    // Stockage centralisé du supporter (tag billet Guadalajara)
    await upsertSupporter({
      firstName,
      lastName,
      email,
      phone,
      city,
      country,
      tags: ["mondial-2026", "billet-guadalajara"],
      note: `Demande Bloc de Guadalajara — réf ${reference}`,
    });

    // Email de confirmation (non-bloquant)
    sendGuadalajaraConfirmation({ to: email, firstName, lastName, reference });

    return new Response(JSON.stringify({ success: true, reference }), { status: 200, headers });
  } catch (err) {
    console.error("Guadalajara demande API error:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur. Réessaie dans quelques instants." }), { status: 500, headers });
  }
};
