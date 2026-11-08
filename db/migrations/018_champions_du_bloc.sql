-- Migration 018: Classement « Les champions du Bloc » (Joueurs, Parties, Records)

CREATE TABLE IF NOT EXISTS champions_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_tag VARCHAR(8) NOT NULL,
  nickname VARCHAR(40) NOT NULL,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_champions_players_token ON champions_players(session_token);
CREATE INDEX IF NOT EXISTS idx_champions_players_tag ON champions_players(public_tag);

CREATE TABLE IF NOT EXISTS champions_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES champions_players(id) ON DELETE CASCADE,
  game VARCHAR(20) NOT NULL, -- 'foot', 'basket', 'envol'
  score INTEGER NOT NULL,    -- streak pour foot/basket, total 3 vols pour envol
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  nonce VARCHAR(64) UNIQUE,  -- idempotent / anti-double soumission
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_champions_matches_game_created ON champions_matches(game, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_champions_matches_player_game ON champions_matches(player_id, game);

CREATE TABLE IF NOT EXISTS champions_records (
  player_id UUID NOT NULL REFERENCES champions_players(id) ON DELETE CASCADE,
  game VARCHAR(20) NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  has_played BOOLEAN NOT NULL DEFAULT true,
  best_match_id UUID REFERENCES champions_matches(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, game)
);

CREATE INDEX IF NOT EXISTS idx_champions_records_game_score ON champions_records(game, best_score DESC, updated_at ASC);

