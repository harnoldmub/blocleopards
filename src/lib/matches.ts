import { deleteObject } from "./storage";

export type MatchSource = "mondial_usa" | "guadalajara" | "billets";

export interface MatchDef {
  key: string;
  label: string;
  venue: string;
  date: string; // YYYY-MM-DD
  source: MatchSource;
}

export const MATCHES: MatchDef[] = [
  { key: "rdc-denmark", label: "RDC vs Danemark",    venue: "Liège (amical)",             date: "2026-06-03", source: "billets" },
  { key: "rdc-chili",   label: "RDC vs Chili",       venue: "Marbella (amical)",          date: "2026-06-09", source: "billets" },
  { key: "houston",     label: "RDC vs Portugal",    venue: "NRG Stadium, Houston",       date: "2026-06-17", source: "mondial_usa" },
  { key: "guadalajara", label: "RDC vs Colombie",    venue: "Estadio Akron, Guadalajara", date: "2026-06-23", source: "guadalajara" },
  { key: "atlanta",     label: "RDC vs Ouzbékistan", venue: "Mercedes-Benz, Atlanta",     date: "2026-06-27", source: "mondial_usa" },
];

export const findMatch = (key: string) => MATCHES.find((m) => m.key === key);

export function isPast(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date + "T00:00:00") < today;
}

/** Nombre de jours écoulés depuis la date du match (négatif si à venir). */
export function daysSince(date: string): number {
  const d = new Date(date + "T00:00:00").getTime();
  return Math.floor((Date.now() - d) / 86_400_000);
}

/**
 * Purge les pièces justificatives d'un match : suppression du fichier (S3 + bytea)
 * et marquage RGPD (deleted_at). Conserve les inscriptions/stats. Retourne le nombre purgé.
 */
export async function purgeMatchDocuments(sql: any, m: MatchDef): Promise<number> {
  if (m.source === "billets") return 0;

  const matchCondition = m.source === "guadalajara"
    ? sql`m.programme = 'ministere_guadalajara'`
    : sql`m.matchs_vises @> ${JSON.stringify([m.key])}::jsonb`;

  const docs = await sql`
    select j.id, j.storage_key from justificatifs_identite j
    join mondial_inscriptions m on m.id = j.inscription_id
    where ${matchCondition} and j.deleted_at is null`;

  for (const d of docs) {
    if (d.storage_key) await deleteObject(d.storage_key);
  }
  if (docs.length > 0) {
    await sql`
      update justificatifs_identite set deleted_at = now(), file_data = null, storage_key = null
      where id = any(${docs.map((d: any) => d.id)})`;
  }
  return docs.length;
}
