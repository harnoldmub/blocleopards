-- Fusion : mondial_inscriptions devient la table unique des demandes de billets Mondial.
-- Guadalajara (programme Ministère) devient un programme avec le match 'guadalajara'.

-- Nouvelles colonnes communes
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS programme TEXT NOT NULL DEFAULT 'tirage_usa';
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS transport_type TEXT;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS needs_lodging BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mondial_inscriptions ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Champs non collectés par tous les programmes → rendre optionnels
ALTER TABLE mondial_inscriptions ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE mondial_inscriptions ALTER COLUMN state_us DROP NOT NULL;
ALTER TABLE mondial_inscriptions ALTER COLUMN phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS mondial_inscriptions_programme_idx ON mondial_inscriptions (programme);

-- Élargir les types de documents acceptés (pièce + preuve de transport en plus de passeport/permis/photo)
ALTER TABLE justificatifs_identite DROP CONSTRAINT IF EXISTS justificatifs_identite_type_document_check;
ALTER TABLE justificatifs_identite ADD CONSTRAINT justificatifs_identite_type_document_check
  CHECK (type_document = ANY (ARRAY['PASSPORT','DRIVER_LICENSE','PHOTO','PIECE_IDENTITE','PREUVE_TRANSPORT']));
