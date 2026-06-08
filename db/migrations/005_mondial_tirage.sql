-- Migration 005_mondial_tirage.sql
create table if not exists mondial_inscriptions (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  email text not null,
  phone text not null,
  country text not null default 'USA',
  city text not null,
  state_us text not null,
  matchs_vises jsonb not null, -- e.g. ["houston", "atlanta"]
  opt_in_mur boolean not null default false,
  ip_address text,
  user_agent text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'flagged', 'rejected')),
  anti_fraud_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_given_at timestamptz,
  validated_by_admin text
);

create table if not exists justificatifs_identite (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references mondial_inscriptions(id) on delete cascade,
  type_document text not null check (type_document in ('PASSPORT', 'DRIVER_LICENSE')),
  original_filename text not null,
  stored_filename text not null,
  mime_type text not null,
  size integer not null,
  checksum text not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'refused')),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists justificatifs_access_logs (
  id uuid primary key default gen_random_uuid(),
  admin_username text not null,
  justificatif_id uuid not null references justificatifs_identite(id) on delete cascade,
  action text not null check (action in ('download', 'view')),
  accessed_at timestamptz not null default now()
);

create index if not exists mondial_inscriptions_email_idx on mondial_inscriptions (lower(email));
create index if not exists mondial_inscriptions_status_idx on mondial_inscriptions (verification_status);
