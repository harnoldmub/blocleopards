-- Store file binary data in DB (filesystem is ephemeral in production)
ALTER TABLE justificatifs_identite ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Missing columns for mondial_inscriptions
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS ticket_number TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS selected_match_key TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS is_diaspora_rdc BOOLEAN;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS ticket_given_at TIMESTAMPTZ;

-- Missing column for mondial_tirage_logs
ALTER TABLE mondial_tirage_logs ADD COLUMN IF NOT EXISTS match_key TEXT;

-- Make phone optional (was NOT NULL in migration 006)
ALTER TABLE mondial_inscriptions ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE mondial_inscriptions ALTER COLUMN state_us DROP NOT NULL;
