create extension if not exists pgcrypto;

create table if not exists adhesions (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text,
  pays text,
  ville text not null,
  role text,
  canal text,
  disponibilite text,
  motivation text,
  charte_accepted boolean not null default false,
  newsletter_opt_in boolean not null default false,
  source text default 'website',
  created_at timestamptz not null default now()
);

alter table adhesions add column if not exists telephone text;
alter table adhesions add column if not exists pays text;
alter table adhesions add column if not exists role text;
alter table adhesions add column if not exists canal text;
alter table adhesions add column if not exists disponibilite text;
alter table adhesions add column if not exists newsletter_opt_in boolean not null default false;

create index if not exists adhesions_email_idx on adhesions (lower(email));

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null,
  objet text not null,
  message text,
  source text default 'website',
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_email_idx on contact_messages (lower(email));

create table if not exists newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
