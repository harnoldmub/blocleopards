ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS is_diaspora_rdc BOOLEAN;
