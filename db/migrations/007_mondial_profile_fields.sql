alter table mondial_inscriptions add column if not exists gender text;
alter table mondial_inscriptions add column if not exists whatsapp text;
alter table mondial_inscriptions add column if not exists is_diaspora_rdc boolean;
alter table mondial_inscriptions add column if not exists updated_at timestamptz default now();
alter table mondial_inscriptions add column if not exists ticket_given_at timestamptz;
alter table settings add column if not exists updated_at timestamptz default now();
alter table justificatifs_identite add column if not exists uploaded_at timestamptz default now();
