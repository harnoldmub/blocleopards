-- Migration des données : guadalajara_demandes → mondial_inscriptions
-- et guadalajara_fichiers → justificatifs_identite. Idempotent (par ticket_number/reference).

-- 1. Demandes → inscriptions (skip si référence déjà migrée ou email déjà présent)
INSERT INTO mondial_inscriptions (
  first_name, last_name, email, phone, whatsapp, country, city,
  programme, matchs_vises, transport_type, needs_lodging,
  verification_status, ticket_given_at, selected_match_key,
  anti_fraud_flags, admin_notes, ticket_number,
  ip_address, user_agent, created_at, updated_at, opt_in_mur
)
SELECT
  d.first_name, d.last_name, lower(d.email), d.phone, d.whatsapp, d.country, d.city,
  'ministere_guadalajara', '["guadalajara"]'::jsonb, d.transport_type, d.needs_lodging,
  CASE WHEN d.status = 'selected' THEN 'verified'
       WHEN d.status IN ('pending','verified','rejected','flagged') THEN d.status
       ELSE 'pending' END,
  CASE WHEN d.status = 'selected' THEN now() ELSE NULL END,
  CASE WHEN d.status = 'selected' THEN 'guadalajara' ELSE NULL END,
  d.anti_fraud_flags, d.admin_notes, d.reference,
  d.ip_address, d.user_agent, d.created_at, d.updated_at, false
FROM guadalajara_demandes d
WHERE NOT EXISTS (SELECT 1 FROM mondial_inscriptions m WHERE m.ticket_number = d.reference)
  AND NOT EXISTS (SELECT 1 FROM mondial_inscriptions m WHERE lower(m.email) = lower(d.email));

-- 2. Fichiers → justificatifs_identite (lien via ticket_number = reference)
INSERT INTO justificatifs_identite (
  inscription_id, type_document, original_filename, stored_filename,
  mime_type, size, checksum, storage_key, file_data, status, created_at
)
SELECT
  m.id, f.type_fichier, f.original_filename, f.stored_filename,
  f.mime_type, f.size, f.checksum, f.storage_key, f.file_data, 'pending', f.created_at
FROM guadalajara_fichiers f
JOIN guadalajara_demandes d ON d.id = f.demande_id
JOIN mondial_inscriptions m ON m.ticket_number = d.reference
WHERE f.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM justificatifs_identite j
    WHERE j.inscription_id = m.id AND j.stored_filename = f.stored_filename
  );
