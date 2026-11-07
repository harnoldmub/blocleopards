import type { Difficulty, GameId } from "./config";

/** Sauvegarde locale (appareil). Toujours tolérante : rien ne casse si le stockage est bloqué. */

export interface RecordEntry {
  name: string;
  score: number;
  mode: string;
  diff: Difficulty;
  date: number;
}

export interface SaveData {
  name: string;
  number: number;
  female?: boolean;
  sound: boolean;
  music: boolean;
  diff: Difficulty;
  tutorial: Record<GameId, boolean>;
  /** Clé `${game}:${diff}` → palier débloqué (1..5) et étoiles par palier. */
  progress: Record<string, { unlocked: number; stars: number[] }>;
  /** Clé `${game}` → top 8 local, toutes catégories. */
  records: Record<string, RecordEntry[]>;
}

const KEY = "bl-arena-v1";

export const DEFAULT_SAVE: SaveData = {
  name: "",
  number: 10,
  sound: true,
  music: false,
  diff: "pro",
  tutorial: { foot: false, basket: false },
  progress: {},
  records: {}
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    return {
      ...clone(DEFAULT_SAVE),
      ...data,
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
  return data.progress[`${game}:${diff}`] || { unlocked: 1, stars: [0, 0, 0, 0, 0] };
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
