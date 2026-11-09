import { useEffect, useState } from "react";
import { LN } from "./i18n-ln";

/**
 * Langues de l'Arène : français (par défaut) et lingala.
 * Les textes restent écrits en français dans le code : t("…") renvoie la
 * traduction lingala quand elle existe, sinon le français (jamais de trou).
 */
export type Lang = "fr" | "ln";

const KEY = "bl-arena-lang";
let current: Lang = "fr";
const listeners = new Set<() => void>();

function applyHtmlLang() {
  if (typeof document !== "undefined") document.documentElement.lang = current === "ln" ? "ln" : "fr";
}

/** Lit la langue mémorisée sur l'appareil (à appeler au démarrage). */
export function initLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ln" || v === "fr") current = v;
  } catch {
    /* stockage indisponible : français */
  }
  applyHtmlLang();
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* la langue vaut pour cette visite */
  }
  applyHtmlLang();
  listeners.forEach((fn) => fn());
}

/** Traduit un texte français ; {nom} est remplacé par vars.nom. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  const s = current === "ln" ? LN[fr] ?? fr : fr;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Composant qui se redessine quand la langue change. */
export function useLang(): Lang {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return current;
}
