import { randomBytes } from "node:crypto";
import { sql, requireDatabase } from "../neon";
import { sanitizePlayerNickname } from "./moderation";

export type ArenaGame = "foot" | "basket" | "envol";
export type LeaderboardPeriod = "week" | "all";

export interface ChampionPlayer {
  id: string;
  public_tag: string;
  nickname: string;
  session_token: string;
  created_at: string;
  updated_at: string;
}

export interface ChampionEntry {
  rank: number;
  player_id: string;
  nickname: string;
  public_tag: string;
  score: number;
  is_current_player?: boolean;
}

export interface LeaderboardResult {
  game: ArenaGame;
  period: LeaderboardPeriod;
  top: ChampionEntry[];
  personal: ChampionEntry | null;
  total_players: number;
  week_start_iso?: string;
}

/** Génère un tag public lisible et stable de 4 caractères (ex. 7K2P), sans caractères ambigus */
export function generatePublicTag(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let tag = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    tag += chars[bytes[i] % chars.length];
  }
  return tag;
}

/** Nettoie et normalise le pseudo (1 à 20 caractères, pas de tags HTML ni de mots bannis) */
export function sanitizeNickname(raw?: string | null): string {
  return sanitizePlayerNickname(raw, "Léopard");
}

/** Calcule le lundi 00:00:00 dans le fuseau horaire Africa/Kinshasa (UTC+1 constant) */
export function getKinshasaWeekStart(now = new Date()): Date {
  const kinshasaOffsetMs = 60 * 60 * 1000; // UTC+1
  const localTime = new Date(now.getTime() + kinshasaOffsetMs);
  const day = localTime.getUTCDay(); // 0: Dimanche, 1: Lundi, ...
  const diffToMonday = (day + 6) % 7;
  localTime.setUTCDate(localTime.getUTCDate() - diffToMonday);
  localTime.setUTCHours(0, 0, 0, 0);
  return new Date(localTime.getTime() - kinshasaOffsetMs);
}

/** Récupère un joueur par son session_token ou en crée un nouveau */
export async function getOrCreatePlayer(
  sessionToken?: string | null,
  initialNickname?: string | null
): Promise<{ player: ChampionPlayer; isNew: boolean }> {
  const db = requireDatabase();

  if (sessionToken && sessionToken.length >= 16) {
    const rows = (await db`
      SELECT id, public_tag, nickname, session_token, created_at, updated_at
      FROM champions_players
      WHERE session_token = ${sessionToken}
      LIMIT 1;
    `) as ChampionPlayer[];

    if (rows.length > 0) {
      return { player: rows[0], isNew: false };
    }
  }

  // Nouveau joueur anonyme
  const token = randomBytes(32).toString("hex");
  const tag = generatePublicTag();
  const nick = sanitizeNickname(initialNickname);

  const inserted = (await db`
    INSERT INTO champions_players (public_tag, nickname, session_token)
    VALUES (${tag}, ${nick}, ${token})
    RETURNING id, public_tag, nickname, session_token, created_at, updated_at;
  `) as ChampionPlayer[];

  return { player: inserted[0], isNew: true };
}

/** Met à jour le pseudo d'un joueur existant sans modifier son id ni ses records */
export async function updatePlayerNickname(playerId: string, newNickname: string): Promise<ChampionPlayer | null> {
  const db = requireDatabase();
  const clean = sanitizeNickname(newNickname);

  const rows = (await db`
    UPDATE champions_players
    SET nickname = ${clean}, updated_at = NOW()
    WHERE id = ${playerId}
    RETURNING id, public_tag, nickname, session_token, created_at, updated_at;
  `) as ChampionPlayer[];

  return rows[0] || null;
}

/** Récupère les records personnels d'un joueur pour les 3 jeux */
export async function getPlayerRecords(playerId: string): Promise<Record<ArenaGame, { best_score: number; has_played: boolean }>> {
  const db = requireDatabase();
  const rows = (await db`
    SELECT game, best_score, has_played
    FROM champions_records
    WHERE player_id = ${playerId};
  `) as { game: ArenaGame; best_score: number; has_played: boolean }[];

  const records: Record<ArenaGame, { best_score: number; has_played: boolean }> = {
    foot: { best_score: 0, has_played: false },
    basket: { best_score: 0, has_played: false },
    envol: { best_score: 0, has_played: false }
  };

  for (const r of rows) {
    if (r.game in records) {
      records[r.game] = { best_score: r.best_score, has_played: r.has_played };
    }
  }

  return records;
}

/** Enregistre une partie terminée avec token de validation serveur */
export async function recordGameMatch(params: {
  playerId: string;
  game: ArenaGame;
  score: number;
  details?: Record<string, any>;
  nonce?: string;
}): Promise<{
  matchId: string;
  score: number;
  bestScore: number;
  isNewRecord: boolean;
  rankAllTime: number;
  rankWeek: number;
}> {
  const db = requireDatabase();
  const { playerId, game, details = {}, nonce } = params;
  const score = Math.max(0, Math.floor(params.score));

  // Vérification de double soumission (idempotence)
  if (nonce) {
    const existing = (await db`
      SELECT id, score FROM champions_matches WHERE nonce = ${nonce} LIMIT 1;
    `) as { id: string; score: number }[];

    if (existing.length > 0) {
      const records = await getPlayerRecords(playerId);
      const ranks = await getPlayerCurrentRanks(playerId, game);
      return {
        matchId: existing[0].id,
        score: existing[0].score,
        bestScore: records[game].best_score,
        isNewRecord: false,
        rankAllTime: ranks.allTime,
        rankWeek: ranks.week
      };
    }
  }

  // 1. Insertion de la partie
  const matchRows = (await db`
    INSERT INTO champions_matches (player_id, game, score, details, nonce)
    VALUES (${playerId}, ${game}, ${score}, ${JSON.stringify(details)}, ${nonce || null})
    RETURNING id;
  `) as { id: string }[];
  const matchId = matchRows[0].id;

  // 2. Gestion du record personnel (un score de 0 est valide et marque has_played: true)
  const existingRecord = (await db`
    SELECT best_score, has_played
    FROM champions_records
    WHERE player_id = ${playerId} AND game = ${game};
  `) as { best_score: number; has_played: boolean }[];

  let isNewRecord = false;
  let bestScore = score;

  if (existingRecord.length === 0) {
    isNewRecord = true;
    await db`
      INSERT INTO champions_records (player_id, game, best_score, best_match_id, has_played)
      VALUES (${playerId}, ${game}, ${score}, ${matchId}, true);
    `;
  } else {
    const prev = existingRecord[0].best_score;
    if (score > prev) {
      isNewRecord = true;
      bestScore = score;
      await db`
        UPDATE champions_records
        SET best_score = ${score}, best_match_id = ${matchId}, has_played = true, updated_at = NOW()
        WHERE player_id = ${playerId} AND game = ${game};
      `;
    } else {
      bestScore = prev;
    }
  }

  // 3. Calcul des rangs
  const ranks = await getPlayerCurrentRanks(playerId, game);

  return {
    matchId,
    score,
    bestScore,
    isNewRecord,
    rankAllTime: ranks.allTime,
    rankWeek: ranks.week
  };
}

/** Calcule les rangs (Tous les temps et Semaine) d'un joueur pour un jeu donné */
export async function getPlayerCurrentRanks(
  playerId: string,
  game: ArenaGame
): Promise<{ allTime: number; week: number }> {
  const db = requireDatabase();
  const weekStart = getKinshasaWeekStart();

  // Rang tous les temps (dense rank sur best_score des records)
  const allTimeRows = (await db`
    WITH ranked AS (
      SELECT player_id, DENSE_RANK() OVER (ORDER BY best_score DESC) as rank
      FROM champions_records
      WHERE game = ${game} AND has_played = true
    )
    SELECT rank FROM ranked WHERE player_id = ${playerId};
  `) as { rank: number }[];

  // Rang de la semaine (dense rank sur MAX(score) des matchs de la semaine)
  const weekRows = (await db`
    WITH week_bests AS (
      SELECT player_id, MAX(score) as best_score
      FROM champions_matches
      WHERE game = ${game} AND created_at >= ${weekStart.toISOString()}
      GROUP BY player_id
    ),
    ranked AS (
      SELECT player_id, DENSE_RANK() OVER (ORDER BY best_score DESC) as rank
      FROM week_bests
    )
    SELECT rank FROM ranked WHERE player_id = ${playerId};
  `) as { rank: number }[];

  return {
    allTime: allTimeRows.length > 0 ? Number(allTimeRows[0].rank) : 0,
    week: weekRows.length > 0 ? Number(weekRows[0].rank) : 0
  };
}

/** Récupère le classement avec podium, top N et position personnelle */
export async function getLeaderboard(params: {
  game: ArenaGame;
  period: LeaderboardPeriod;
  currentPlayerId?: string | null;
  limit?: number;
}): Promise<LeaderboardResult> {
  const db = requireDatabase();
  const { game, period, currentPlayerId, limit = 20 } = params;
  const weekStart = getKinshasaWeekStart();

  let rows: {
    rank: number;
    player_id: string;
    nickname: string;
    public_tag: string;
    score: number;
  }[] = [];

  if (period === "all") {
    // Tous les temps
    rows = (await db`
      WITH ranked AS (
        SELECT
          r.player_id,
          p.nickname,
          p.public_tag,
          r.best_score AS score,
          DENSE_RANK() OVER (ORDER BY r.best_score DESC, r.updated_at ASC) as rank
        FROM champions_records r
        JOIN champions_players p ON p.id = r.player_id
        WHERE r.game = ${game} AND r.has_played = true
      )
      SELECT rank, player_id, nickname, public_tag, score
      FROM ranked
      ORDER BY rank ASC, nickname ASC;
    `) as any[];
  } else {
    // Cette semaine (selon fuseau Africa/Kinshasa)
    rows = (await db`
      WITH week_bests AS (
        SELECT player_id, MAX(score) as best_score, MAX(created_at) as latest_at
        FROM champions_matches
        WHERE game = ${game} AND created_at >= ${weekStart.toISOString()}
        GROUP BY player_id
      ),
      ranked AS (
        SELECT
          w.player_id,
          p.nickname,
          p.public_tag,
          w.best_score AS score,
          DENSE_RANK() OVER (ORDER BY w.best_score DESC, w.latest_at ASC) as rank
        FROM week_bests w
        JOIN champions_players p ON p.id = w.player_id
      )
      SELECT rank, player_id, nickname, public_tag, score
      FROM ranked
      ORDER BY rank ASC, nickname ASC;
    `) as any[];
  }

  const total_players = rows.length;
  const top: ChampionEntry[] = rows.slice(0, limit).map((r) => ({
    rank: Number(r.rank),
    player_id: r.player_id,
    nickname: r.nickname,
    public_tag: r.public_tag,
    score: Number(r.score),
    is_current_player: currentPlayerId ? r.player_id === currentPlayerId : false
  }));

  // Position personnelle si le joueur courant existe
  let personal: ChampionEntry | null = null;
  if (currentPlayerId) {
    const personalRow = rows.find((r) => r.player_id === currentPlayerId);
    if (personalRow) {
      personal = {
        rank: Number(personalRow.rank),
        player_id: personalRow.player_id,
        nickname: personalRow.nickname,
        public_tag: personalRow.public_tag,
        score: Number(personalRow.score),
        is_current_player: true
      };
    }
  }

  return {
    game,
    period,
    top,
    personal,
    total_players,
    week_start_iso: weekStart.toISOString()
  };
}

