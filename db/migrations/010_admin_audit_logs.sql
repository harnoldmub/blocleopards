create table if not exists admin_audit_logs (
  id serial primary key,
  admin_user text not null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb default '{}',
  ip_address text,
  created_at timestamptz default now()
);
create index if not exists admin_audit_logs_created_at_idx on admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_user_idx on admin_audit_logs(admin_user);
