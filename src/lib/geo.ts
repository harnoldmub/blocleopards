/**
 * Pays / villes pour les formulaires (serveur uniquement : la base villes de
 * country-state-city pèse plusieurs Mo, on ne l'envoie jamais au navigateur).
 */
import { City, Country } from "country-state-city";

export interface GeoCountry {
  iso: string;
  name: string;
  /** Indicatif sans « + », ex. "243". */
  dial: string;
}

/** Affichés en tête de liste : RDC, voisins et diaspora. */
const PRIORITY = ["CD", "CG", "BE", "FR", "AO", "GB", "US", "CA", "ZA", "CH", "DE"];
const NAME_OVERRIDES: Record<string, string> = { CD: "RD Congo", CG: "Congo-Brazzaville" };

let cache: GeoCountry[] | null = null;

export function getCountries(): GeoCountry[] {
  if (cache) return cache;
  const names = new Intl.DisplayNames(["fr"], { type: "region" });
  const all = Country.getAllCountries()
    .map((c) => ({
      iso: c.isoCode,
      name: NAME_OVERRIDES[c.isoCode] ?? names.of(c.isoCode) ?? c.name,
      dial: c.phonecode.replace(/^\+/, "").split(/[-\s]/)[0]
    }))
    .filter((c) => c.dial);

  const priority = PRIORITY.flatMap((iso) => all.filter((c) => c.iso === iso));
  const rest = all.filter((c) => !PRIORITY.includes(c.iso)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  cache = [...priority, ...rest];
  return cache;
}

export function getCityNames(iso: string): string[] {
  const cities = City.getCitiesOfCountry(iso.toUpperCase()) ?? [];
  return [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "fr"));
}
