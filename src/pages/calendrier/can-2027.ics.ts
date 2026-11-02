import type { APIRoute } from "astro";
import { TEAMS, rdcFixtures } from "../../data/can2027";

export const prerender = false;

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);

/**
 * GET /calendrier/can-2027.ics — matchs à venir de la RDC (Groupe E).
 * Option ?match=<id> pour un seul match.
 */
export const GET: APIRoute = ({ url }) => {
  const only = url.searchParams.get("match");
  const matches = rdcFixtures("UPCOMING").filter((f) => f.kickoff && (!only || f.id === only));

  const events = matches.map((f) => {
    const start = f.kickoff!;
    const end = new Date(Date.parse(start) + 2 * 3600_000).toISOString();
    const title = `Éliminatoires CAN 2027 : ${TEAMS[f.home].name} – ${TEAMS[f.away].name}`;
    return [
      "BEGIN:VEVENT",
      `UID:bloc-leopards-can2027-${f.id}@blocleopards.com`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      `LOCATION:${esc([f.venue, f.city, f.country].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${esc(`Journée ${f.matchday}, groupe E. Programme et consignes du Bloc : https://blocleopards.com/can-2027`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT3H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title)}`,
      "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  });

  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bloc Leopards//CAN 2027//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events, "END:VCALENDAR"].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="leopards-can-2027${only ? `-${only}` : ""}.ics"`
    }
  });
};
