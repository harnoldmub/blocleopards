CREATE TABLE IF NOT EXISTS mondial_tirage_logs (
  id SERIAL PRIMARY KEY,
  seed TEXT NOT NULL,
  engagement_hash TEXT NOT NULL,
  candidates_count INTEGER NOT NULL,
  winners_count INTEGER NOT NULL,
  winner_ids JSONB NOT NULL DEFAULT '[]',
  published BOOLEAN NOT NULL DEFAULT false,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
