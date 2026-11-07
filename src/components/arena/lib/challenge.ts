import type { Difficulty, GameId } from "./config";
import { cleanName } from "./storage";

/** Défi entre amis : tout tient dans l'URL (pas de serveur). Même graine = mêmes conditions. */
export interface Challenge {
  g: GameId;
  /** Palier (1..15) ou 0 pour la série standard. */
  st: number;
  d: Difficulty;
  seed: number;
  n: string;
  p: number;
  /** Manche : 0 = défi initial, 1+ = revanches successives. */
  r?: number;
}

export function encodeChallenge(c: Challenge): string {
  const json = JSON.stringify(c);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChallenge(raw: string | null): Challenge | null {
  if (!raw || raw.length > 400) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const c = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if (c.g !== "foot" && c.g !== "basket") return null;
    if (!["facile", "pro", "legende"].includes(c.d)) return null;
    const st = Number(c.st);
    const p = Number(c.p);
    const seed = Number(c.seed);
    if (!Number.isInteger(st) || st < 0 || st > 15) return null;
    if (!Number.isFinite(p) || p < 0 || p > 100000) return null;
    if (!Number.isInteger(seed)) return null;
    const r = Math.max(0, Math.min(99, Math.floor(Number(c.r) || 0)));
    return { g: c.g, st, d: c.d, seed, p: Math.round(p), n: cleanName(String(c.n || ""), "Un ami"), r };
  } catch {
    return null;
  }
}

export function challengeUrl(c: Challenge): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://blocleopards.com";
  return `${origin}/jeux?defi=${encodeChallenge(c)}`;
}

/** Clé stable d'un défi (même série de tirs). */
export const challengeKey = (c: Pick<Challenge, "g" | "seed" | "st" | "d">) => `${c.g}:${c.st}:${c.d}:${c.seed}`;
