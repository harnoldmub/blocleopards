import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../../lib/auth";
import { requireDatabase } from "../../../../lib/neon";

export const prerender = false;

const MATCH_LABELS: Record<string, string> = {
  houston: "RDC vs Portugal (Houston)",
  guadalajara: "RDC vs Colombie (Guadalajara)",
  atlanta: "RDC vs Ouzbékistan (Atlanta)",
};

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response("Non autorisé", { status: 401 });
  }

  const sql = requireDatabase();

  const rows = await sql`
    select
      m.id,
      m.ticket_number,
      m.first_name,
      m.last_name,
      m.gender,
      m.date_of_birth,
      m.email,
      m.phone,
      m.whatsapp,
      m.country,
      m.city,
      m.state_us,
      m.is_diaspora_rdc,
      m.matchs_vises,
      m.verification_status,
      m.ticket_given_at,
      m.selected_match_key,
      m.anti_fraud_flags,
      m.created_at
    from mondial_inscriptions m
    where m.programme = 'tirage_usa'
    order by m.created_at desc
  `;

  const headers = [
    "ID", "Numéro ticket", "Prénom", "Nom", "Genre", "Date de naissance",
    "Email", "Téléphone", "WhatsApp", "Pays", "Ville", "État (USA)",
    "Diaspora RDC", "Matchs visés", "Statut vérification",
    "Billet attribué le", "Match sélectionné", "Alertes fraude", "Inscrit le"
  ];

  const csvRows = rows.map((r: any) => {
    const matchs = Array.isArray(r.matchs_vises)
      ? r.matchs_vises.map((k: string) => MATCH_LABELS[k] || k).join(" | ")
      : "";
    const flags = Array.isArray(r.anti_fraud_flags) ? r.anti_fraud_flags.join(" | ") : "";
    return [
      r.id, r.ticket_number, r.first_name, r.last_name, r.gender,
      r.date_of_birth ? new Date(r.date_of_birth).toLocaleDateString("fr-FR") : "",
      r.email, r.phone, r.whatsapp, r.country, r.city, r.state_us,
      r.is_diaspora_rdc ? "Oui" : "Non",
      matchs,
      r.verification_status,
      r.ticket_given_at ? new Date(r.ticket_given_at).toLocaleString("fr-FR") : "",
      r.selected_match_key ? (MATCH_LABELS[r.selected_match_key] || r.selected_match_key) : "",
      flags,
      new Date(r.created_at).toLocaleString("fr-FR"),
    ].map(escapeCSV).join(",");
  });

  const csv = [headers.join(","), ...csvRows].join("\n");
  const filename = `inscriptions-mondial-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
