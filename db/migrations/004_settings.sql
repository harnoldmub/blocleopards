create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into settings (key, value) values ('billeterie_active', 'true') on conflict do nothing;
