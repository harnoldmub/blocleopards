create extension if not exists pgcrypto;

create table if not exists billetterie_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_code text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  whatsapp text not null,
  country text not null,
  quantity integer not null check (quantity between 1 and 4),
  unit_price_fc integer not null default 69000 check (unit_price_fc > 0),
  total_price_fc integer not null check (total_price_fc > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billetterie_reservations_created_idx
  on billetterie_reservations (created_at desc);

create index if not exists billetterie_reservations_name_idx
  on billetterie_reservations (lower(last_name), lower(first_name));

create index if not exists billetterie_reservations_status_idx
  on billetterie_reservations (status);
