create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  body text not null default '',
  date date not null,
  time text not null default '',
  location text not null default '',
  cta text not null default '',
  map text,
  image text,
  category text not null default 'event',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_date_idx on events (date);
create index if not exists events_published_date_idx on events (published, date);
