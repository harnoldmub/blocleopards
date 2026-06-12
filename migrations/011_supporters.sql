CREATE TABLE IF NOT EXISTS supporters (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Canada',
  source_list TEXT,
  priority TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supporters_email_idx ON supporters (lower(email));
CREATE INDEX IF NOT EXISTS supporters_name_idx ON supporters (lower(first_name), lower(last_name));
CREATE INDEX IF NOT EXISTS supporters_country_idx ON supporters (country);
