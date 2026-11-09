/**
 * Module de modération des pseudos pour L'Arène des Léopards.
 * Filtre les termes sensibles, sexuels, anatomiques et vulgaires
 * en Lingala, Français et Anglais, y compris les variantes leetspeak
 * et séparateurs (espaces, tirets, ponctuation, substitutions de caractères).
 */

const BLOCKED_WORDS = [
  // ---------------- Lingala (anatomie, sexualité, insultes vulgaires) ----------------
  "libolo",
  "mabolo",
  "ebolo",
  "likata",
  "makata",
  "ekata",
  "lifuni",
  "mafuni",
  "efuni",
  "libindi",
  "mabindi",
  "ebindi",
  "libele",
  "mabele",
  "lisoko",
  "masoko",
  "mupete",
  "mapete",
  "lopete",
  "ndumba",
  "zoba",
  "zobazoba",
  "nyei",
  "moyibi",
  "koyiba",
  "kotia",
  "kotiya",
  "bolukani",
  "tshobo",

  // ---------------- Français (termes vulgaires, sexuels, injures) ----------------
  "bite",
  "couille",
  "couilles",
  "chatte",
  "chattes",
  "clito",
  "clitoris",
  "penis",
  "vagin",
  "fion",
  "sperme",
  "foutre",
  "branle",
  "branleur",
  "baise",
  "baiser",
  "encule",
  "enculer",
  "enculee",
  "salope",
  "salop",
  "pute",
  "putain",
  "connard",
  "conne",
  "batard",
  "fdp",
  "nique",
  "niquer",
  "tapette",
  "gouine",
  "negre",
  "negro",

  // ---------------- Anglais (termes offensants / sexuels) ----------------
  "fuck",
  "fucker",
  "fucking",
  "bitch",
  "pussy",
  "dick",
  "cock",
  "asshole",
  "cunt",
  "slut",
  "whore",
  "nigger",
  "nigga",
  "faggot"
];

/**
 * Normalise une chaîne pour neutraliser les tentatives de contournement :
 * minuscules, sans accents, sans espaces/séparateurs, et conversion leetspeak.
 */
export function normalizeForModeration(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/@/g, "a")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Vérifie si un pseudo contient un mot sensible / banni.
 */
export function isNameBlocked(name?: string | null): boolean {
  if (!name) return false;
  const norm = normalizeForModeration(name);
  if (!norm) return false;

  for (const word of BLOCKED_WORDS) {
    if (norm.includes(word)) {
      return true;
    }
  }
  return false;
}

/**
 * Valide un pseudo. Renvoie { ok: true } ou { ok: false, error: string }.
 */
export function validatePlayerNickname(name?: string | null): { ok: boolean; error?: string } {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Le pseudo ne peut pas être vide." };
  }
  if (trimmed.length > 20) {
    return { ok: false, error: "Le pseudo ne doit pas dépasser 20 caractères." };
  }
  if (isNameBlocked(trimmed)) {
    return { ok: false, error: "Ce pseudo n'est pas autorisé." };
  }
  return { ok: true };
}

/**
 * Assainit un pseudo : supprime les caractères invalides et remplace
 * tout pseudo bloqué par un nom par défaut sain ("Léopard").
 */
export function sanitizePlayerNickname(raw?: string | null, fallback = "Léopard"): string {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[<>{}[\]\\`"']/g, "").trim().slice(0, 20);
  if (!cleaned || isNameBlocked(cleaned)) {
    return fallback;
  }
  return cleaned;
}
