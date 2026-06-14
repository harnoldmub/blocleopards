-- Demandes "Le Bloc de Guadalajara" — programme diaspora Ministère des Sports
-- Match RDC vs Colombie, 23 juin 2026, Guadalajara (Mexique)
CREATE TABLE IF NOT EXISTS guadalajara_demandes (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  country TEXT,
  city TEXT,
  transport_type TEXT,
  needs_lodging BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  anti_fraud_flags JSONB NOT NULL DEFAULT '[]',
  admin_notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT guadalajara_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS guadalajara_status_idx ON guadalajara_demandes (status);

-- Fichiers joints (pièce d'identité + preuve de transport), stockés en DB
CREATE TABLE IF NOT EXISTS guadalajara_fichiers (
  id SERIAL PRIMARY KEY,
  demande_id INTEGER NOT NULL REFERENCES guadalajara_demandes(id) ON DELETE CASCADE,
  type_fichier TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  file_data BYTEA,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guadalajara_fichiers_demande_idx ON guadalajara_fichiers (demande_id);
