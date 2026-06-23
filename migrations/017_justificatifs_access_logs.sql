CREATE TABLE IF NOT EXISTS justificatifs_access_logs (
  id SERIAL PRIMARY KEY,
  admin_username TEXT,
  justificatif_id INTEGER,
  action TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS justificatifs_access_logs_jid_idx ON justificatifs_access_logs (justificatif_id);
