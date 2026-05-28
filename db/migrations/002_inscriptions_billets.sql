create extension if not exists pgcrypto;

create table if not exists inscriptions_billets (
  id uuid primary key default gen_random_uuid(),
  match_key text not null check (match_key in ('rdc-denmark', 'rdc-chili')),
  first_name text not null,
  last_name text not null,
  phone text,
  email text not null,
  country text,
  country_code text,
  city text,
  source text not null default 'formulaire' check (source in ('formulaire', 'chatbot')),
  status text not null default 'pending' check (status in ('pending', 'selected', 'ticket_given', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_given_at timestamptz,
  validated_by_admin text
);

create index if not exists inscriptions_billets_email_idx on inscriptions_billets (lower(email));
create index if not exists inscriptions_billets_match_key_idx on inscriptions_billets (match_key);
create index if not exists inscriptions_billets_status_idx on inscriptions_billets (status);
create index if not exists inscriptions_billets_created_idx on inscriptions_billets (created_at desc);
