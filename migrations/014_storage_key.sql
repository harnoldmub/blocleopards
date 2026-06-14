-- Référence vers le stockage objet S3 (Railway/Tigris).
-- Si storage_key est renseigné, le fichier est dans le bucket ; sinon file_data (bytea) sert de fallback.
ALTER TABLE guadalajara_fichiers ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE justificatifs_identite ADD COLUMN IF NOT EXISTS storage_key TEXT;
