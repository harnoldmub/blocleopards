CREATE TABLE IF NOT EXISTS mondial_inscriptions (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  city TEXT NOT NULL,
  state_us TEXT NOT NULL,
  matchs_vises JSONB NOT NULL DEFAULT '[]',
  opt_in_mur BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  anti_fraud_flags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mondial_inscriptions_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS justificatifs_identite (
  id SERIAL PRIMARY KEY,
  inscription_id INTEGER NOT NULL REFERENCES mondial_inscriptions(id) ON DELETE CASCADE,
  type_document TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
