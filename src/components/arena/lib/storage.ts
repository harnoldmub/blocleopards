import type { Difficulty, GameId } from "./config";

/** Sauvegarde locale (appareil). Toujours tolérante : rien ne casse si le stockage est bloqué. */

export interface RecordEntry {
  name: string;
  score: number;
  mode: string;
  diff: Difficulty;
  date: number;
}

export interface PlayerStats {
  totalShots: number;
  totalGoals: number;
  totalBaskets: number;
  totalPoints: number;
  bestStreakFoot: number;
  bestStreakBasket: number;
  gamesPlayed: number;
  stagesCleared: number;
  lastPlayedDate: number;
}

/** Défi joué ou envoyé (historique local). */
export interface DuelEntry {
  key: string;
  /** Ami concerné (vide pour un défi envoyé à tout le monde). */
  friend: string;
  game: GameId;
  st: number;
  diff: Difficulty;
  seed: number;
  me: number;
  them: number | null;
  outcome: "won" | "lost" | "tie" | "sent";
  round: number;
  date: number;
}

export interface SaveData {
  name: string;
  number: number;
  female?: boolean;
  /** Personnage choisi (voir lib/roster). */
  character?: string;
  sound: boolean;
  music: boolean;
  diff: Difficulty;
  tutorial: Record<GameId, boolean>;
  /** Clé `${game}:${diff}` → palier débloqué (1..15) et étoiles par palier. */
  progress: Record<string, { unlocked: number; stars: number[] }>;
  /** Clé `${game}` → top 8 local, toutes catégories. */
  records: Record<string, RecordEntry[]>;
  /** Statistiques cumulées de progression et d'évolution du joueur. */
  stats: PlayerStats;
  /** Derniers défis (envoyés, gagnés, perdus). */
  duels?: DuelEntry[];
}

const KEY = "bl-arena-v1";

export const DEFAULT_STATS: PlayerStats = {
  totalShots: 0,
  totalGoals: 0,
  totalBaskets: 0,
  totalPoints: 0,
  bestStreakFoot: 0,
  bestStreakBasket: 0,
  gamesPlayed: 0,
  stagesCleared: 0,
  lastPlayedDate: 0
};

export const DEFAULT_SAVE: SaveData = {
  name: "",
  number: 10,
  sound: true,
  music: false,
  diff: "pro",
  tutorial: { foot: false, basket: false, envol: false },
  progress: {},
  records: {},
  stats: DEFAULT_STATS
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    return {
      ...clone(DEFAULT_SAVE),
      ...data,
      stats: { ...DEFAULT_STATS, ...(data.stats || {}) },
      tutorial: { ...DEFAULT_SAVE.tutorial, ...(data.tutorial || {}) }
    };
  } catch {
    return clone(DEFAULT_SAVE);
  }
}

/** Copie profonde compatible avec les anciens navigateurs mobiles (pas de structuredClone). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function persist(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* stockage indisponible : la partie continue */
  }
}

export function progressOf(data: SaveData, game: GameId, diff: Difficulty) {
  const p = data.progress[`${game}:${diff}`];
  if (!p) return { unlocked: 1, stars: Array(15).fill(0) };
  const stars = Array(15).fill(0);
  (p.stars || []).forEach((st, i) => {
    if (i < 15) stars[i] = st;
  });
  return { unlocked: p.unlocked || 1, stars };
}

export function addRecord(data: SaveData, game: GameId, entry: RecordEntry): { data: SaveData; rank: number } {
  const list = [...(data.records[game] || []), entry].sort((a, b) => b.score - a.score).slice(0, 8);
  const rank = list.indexOf(entry);
  return { data: { ...data, records: { ...data.records, [game]: list } }, rank };
}

export function cleanName(raw: string, fallback = "Léopard"): string {
  const s = (raw || "")
    .replace(/[<>"'`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
  return s || fallback;
}

export function playerEvolution(data: SaveData) {
  let totalStars = 0;
  for (const k in data.progress) {
    const p = data.progress[k];
    if (p && p.stars) {
      totalStars += p.stars.reduce((acc, st) => acc + (st || 0), 0);
    }
  }
  const goals = data.stats?.totalGoals || 0;
  const baskets = data.stats?.totalBaskets || 0;
  const pts = data.stats?.totalPoints || 0;
  const shots = data.stats?.totalShots || 0;
  const maxFoot = Math.max(1, ...(Object.keys(data.progress).filter((k) => k.startsWith("foot:")).map((k) => data.progress[k]?.unlocked || 1)));
  const maxBasket = Math.max(1, ...(Object.keys(data.progress).filter((k) => k.startsWith("basket:")).map((k) => data.progress[k]?.unlocked || 1)));

  let rankTitle = "Nouvelle Recrue";
  let level = 1;
  if (totalStars >= 45 || (maxFoot >= 15 && maxBasket >= 15)) {
    rankTitle = "Légende des Léopards 🐆";
    level = 6;
  } else if (totalStars >= 30 || maxFoot >= 12 || maxBasket >= 12) {
    rankTitle = "Maître des Martyrs 🏟️";
    level = 5;
  } else if (totalStars >= 18 || maxFoot >= 8 || maxBasket >= 8) {
    rankTitle = "Fimbu d'Or ✨";
    level = 4;
  } else if (totalStars >= 10 || maxFoot >= 5 || maxBasket >= 5) {
    rankTitle = "Titulaire du Onze ⚽";
    level = 3;
  } else if (totalStars >= 3 || maxFoot >= 2 || maxBasket >= 2) {
    rankTitle = "Espoir de Kinshasa 🇨🇩";
    level = 2;
  }

  return {
    level,
    rankTitle,
    totalStars,
    goals,
    baskets,
    shots,
    pts,
    maxFoot,
    maxBasket,
    streakFoot: data.stats?.bestStreakFoot || 0,
    streakBasket: data.stats?.bestStreakBasket || 0
  };
}

/** Ajoute (ou met à jour) un défi dans l'historique : 10 derniers. */
export function addDuel(data: SaveData, e: DuelEntry): SaveData {
  const list = (data.duels || []).filter((d) => !(d.key === e.key && d.friend === e.friend));
  return { ...data, duels: [e, ...list].slice(0, 10) };
}
