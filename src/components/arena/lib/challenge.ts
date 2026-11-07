import type { Difficulty, GameId } from "./config";
import { cleanName } from "./storage";

/** Défi entre amis : tout tient dans l'URL (pas de serveur). Même graine = mêmes conditions. */
export interface Challenge {
  g: GameId;
  /** Palier (1..5) ou 0 pour la série standard du duel. */
  st: number;
  d: Difficulty;
  seed: number;
  n: string;
  p: number;
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
    if (!Number.isInteger(st) || st < 0 || st > 5) return null;
    if (!Number.isFinite(p) || p < 0 || p > 100000) return null;
    if (!Number.isInteger(seed)) return null;
    return { g: c.g, st, d: c.d, seed, p: Math.round(p), n: cleanName(String(c.n || ""), "Un ami") };
  } catch {
    return null;
  }
}

export function challengeUrl(c: Challenge): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://blocleopards.com";
  return `${origin}/jeux?defi=${encodeChallenge(c)}`;
}
