CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
