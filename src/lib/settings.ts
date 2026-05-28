import { requireDatabase } from "./neon";

let _cache: Record<string, string> | null = null;
let _cacheTs = 0;
const TTL = 30_000;

export async function getSettings(): Promise<Record<string, string>> {
  if (_cache && Date.now() - _cacheTs < TTL) return _cache;
  try {
    const sql = requireDatabase();
    const rows = await sql`select key, value from settings`;
    _cache = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    _cacheTs = Date.now();
    return _cache!;
  } catch {
    return {};
  }
}

export function invalidateSettings() {
  _cache = null;
  _cacheTs = 0;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await getSettings();
  return s[key] ?? fallback;
}
