import { requireDatabase } from "./neon";

export interface SupporterInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  tags: string[];
  note?: string | null;
}

// Ordre important : Belgique avant RDC ("RDC Belgique" = diaspora en Belgique)
const COUNTRY_ALIASES: [RegExp, string][] = [
  [/belgi/i, "Belgique"],
  [/rdc|congo|drc/i, "RDC"],
  [/usa|etats[- ]?unis|états[- ]?unis|united states/i, "États-Unis"],
  [/^(canada|ca)$/i, "Canada"],
  [/^(france|fr)$/i, "France"],
  [/england|royaume|united kingdom|^uk$/i, "Royaume-Uni"],
  [/irlande|ireland|irilanda/i, "Irlande"],
  [/germany|allemagne/i, "Allemagne"],
  [/austral/i, "Australie"],
  [/suede|sweden|suède/i, "Suède"],
  [/espagne|spain/i, "Espagne"],
  [/pays[- ]bas|netherlands|holland/i, "Pays-Bas"],
  [/italie|italy/i, "Italie"],
  [/afri.* du sud|south africa/i, "Afrique du Sud"],
];

export function normalizeCountry(raw?: string | null): string {
  const v = (raw || "").trim();
  if (!v) return "Non renseigné";
  for (const [re, label] of COUNTRY_ALIASES) {
    if (re.test(v)) return label;
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Upsert d'un supporter dans la base centralisée.
 * Dédoublonnage : par email si présent, sinon par prénom+nom.
 * En cas de match : complète les champs manquants, fusionne les tags, ajoute la note.
 * Best-effort — ne doit jamais faire échouer le formulaire appelant.
 */
export async function upsertSupporter(input: SupporterInput): Promise<void> {
  try {
    const sql = requireDatabase();
    const email = input.email?.trim().toLowerCase() || null;
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    if (!firstName && !lastName) return;

    let existing: any[] = [];
    if (email) {
      existing = await sql`select id, tags, notes from supporters where lower(email) = ${email} limit 1`;
    }
    if (existing.length === 0 && firstName && lastName) {
      existing = await sql`
        select id, tags, notes from supporters
        where lower(first_name) = ${firstName.toLowerCase()} and lower(last_name) = ${lastName.toLowerCase()}
        limit 1
      `;
    }

    const note = input.note?.trim() || null;

    if (existing.length > 0) {
      const row = existing[0];
      const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
      for (const t of input.tags) if (!tags.includes(t)) tags.push(t);
      const mergedNotes = note
        ? [row.notes, `[${new Date().toISOString().slice(0, 10)}] ${note}`].filter(Boolean).join("\n")
        : row.notes;
      await sql`
        update supporters set
          email = coalesce(email, ${email}),
          phone = coalesce(phone, ${input.phone?.trim() || null}),
          city = coalesce(city, ${input.city?.trim() || null}),
          tags = ${JSON.stringify(tags)},
          notes = ${mergedNotes},
          updated_at = now()
        where id = ${row.id}
      `;
    } else {
      await sql`
        insert into supporters (first_name, last_name, email, phone, city, country, tags, notes)
        values (
          ${firstName || "—"}, ${lastName || "—"}, ${email}, ${input.phone?.trim() || null},
          ${input.city?.trim() || null}, ${normalizeCountry(input.country)},
          ${JSON.stringify(input.tags)},
          ${note ? `[${new Date().toISOString().slice(0, 10)}] ${note}` : null}
        )
      `;
    }
  } catch (err) {
    console.error("Supporter upsert error (non-bloquant):", err);
  }
}
