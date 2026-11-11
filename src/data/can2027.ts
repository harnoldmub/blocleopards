/**
 * Éliminatoires CAN 2027 — Groupe E. Source unique de la page /can-2027,
 * du bandeau d'accueil et du fichier calendrier (.ics).
 *
 * Après chaque match : passer `status` à "FINISHED" et remplir `score`
 * (+ `scorers` pour la RDC). Le classement se recalcule tout seul.
 * Résultats J1/J2 vérifiés (Radio Okapi, France 24, Mediacongo, sept. 2026).
 */

/** Dernière mise à jour du programme (actu du 2 novembre 2026). À changer à chaque modification des matchs. */
export const PROGRAMME_UPDATED = "2026-11-02";
export const PROGRAMME_SOURCE = { label: "Programme des éliminatoires CAN 2027", href: "/can-2027" };

export type TeamCode = "RDC" | "GQ" | "SL" | "ZW";

export interface Team {
  code: TeamCode;
  name: string;
  flag: string;
  isRDC?: boolean;
}

export const TEAMS: Record<TeamCode, Team> = {
  RDC: { code: "RDC", name: "RD Congo", flag: "/flags/cd.svg", isRDC: true },
  GQ: { code: "GQ", name: "Guinée équatoriale", flag: "/flags/gq.svg" },
  SL: { code: "SL", name: "Sierra Leone", flag: "/flags/sl.svg" },
  ZW: { code: "ZW", name: "Zimbabwe", flag: "/flags/zw.svg" }
};

export type MatchStatus = "UPCOMING" | "FINISHED";

export interface Fixture {
  id: string;
  matchday: number;
  home: TeamCode;
  away: TeamCode;
  /** ISO avec fuseau ; absent si la date n'est pas encore fixée. */
  kickoff?: string;
  /** Libellé affiché quand la date exacte manque. */
  dateLabel?: string;
  venue?: string;
  city?: string;
  country?: string;
  status: MatchStatus;
  score?: { home: number; away: number };
  scorers?: { player: string; minute: string }[];
}

export const FIXTURES: Fixture[] = [
  // Journée 1
  {
    id: "j1-rdc-gq",
    matchday: 1,
    home: "RDC",
    away: "GQ",
    kickoff: "2026-09-24T17:00:00+01:00",
    venue: "Stade des Martyrs",
    city: "Kinshasa",
    country: "RD Congo",
    status: "FINISHED",
    score: { home: 2, away: 0 },
    scorers: [
      { player: "C. Mbemba", minute: "4'" },
      { player: "Y. Wissa", minute: "72'" }
    ]
  },
  { id: "j1-sl-zw", matchday: 1, home: "SL", away: "ZW", dateLabel: "Septembre 2026", status: "FINISHED", score: { home: 2, away: 3 } },
  // Journée 2
  {
    id: "j2-zw-rdc",
    matchday: 2,
    home: "ZW",
    away: "RDC",
    kickoff: "2026-09-28T18:00:00+02:00",
    venue: "National Sports Stadium",
    city: "Harare",
    country: "Zimbabwe",
    status: "FINISHED",
    score: { home: 1, away: 2 },
    scorers: [
      { player: "Y. Wissa", minute: "30'" },
      { player: "G. Moutoussamy", minute: "45+2'" }
    ]
  },
  { id: "j2-gq-sl", matchday: 2, home: "GQ", away: "SL", dateLabel: "28 septembre 2026", status: "FINISHED", score: { home: 1, away: 0 } },
  // Journée 3 — affiche officielle Bloc Léopards
  {
    id: "j3-rdc-sl",
    matchday: 3,
    home: "RDC",
    away: "SL",
    kickoff: "2026-11-12T17:00:00+01:00",
    venue: "Stade des Martyrs",
    city: "Kinshasa",
    country: "RD Congo",
    status: "UPCOMING"
  },
  { id: "j3-gq-zw", matchday: 3, home: "GQ", away: "ZW", dateLabel: "12 novembre 2026", status: "UPCOMING" },
  // Journée 4
  {
    id: "j4-sl-rdc",
    matchday: 4,
    home: "SL",
    away: "RDC",
    kickoff: "2026-11-17T17:00:00+01:00",
    venue: "Stade Ben Ahmed El Abdi",
    city: "El Jadida",
    country: "Maroc",
    status: "UPCOMING"
  },
  { id: "j4-zw-gq", matchday: 4, home: "ZW", away: "GQ", dateLabel: "Fenêtre du 11 au 17 novembre", status: "UPCOMING" }
];

/** Fenêtres CAF des 6 journées (pour le calendrier de campagne). */
export const WINDOWS = [
  { label: "Journées 1 & 2", dates: "24 → 28 septembre 2026", detail: "RDC 2–0 Guinée éq. · Zimbabwe 1–2 RDC", state: "done" },
  { label: "Journées 3 & 4", dates: "12 → 17 novembre 2026", detail: "RDC – Sierra Leone (Kinshasa) · Sierra Leone – RDC (El Jadida)", state: "current" },
  { label: "Journées 5 & 6", dates: "Mars 2027", detail: "RDC – Zimbabwe · Guinée éq. – RDC (dates CAF à venir)", state: "next" }
] as const;

export const isRdcMatch = (f: Fixture) => f.home === "RDC" || f.away === "RDC";

export const rdcFixtures = (status?: MatchStatus) =>
  FIXTURES.filter((f) => isRdcMatch(f) && (!status || f.status === status));

/** Prochain match de la RDC (date future), ou `undefined`. */
export function nextRdcFixture(now = new Date()) {
  return rdcFixtures("UPCOMING")
    .filter((f) => f.kickoff && new Date(f.kickoff).getTime() > now.getTime() - 3 * 3600_000)
    .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!))[0];
}

export interface Standing {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** Classement : points, différence de buts, buts marqués (départage simplifié). */
export function computeStandings(fixtures = FIXTURES): Standing[] {
  const rows = new Map<TeamCode, Standing>(
    (Object.keys(TEAMS) as TeamCode[]).map((code) => [
      code,
      { position: 0, team: TEAMS[code], played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 }
    ])
  );

  for (const f of fixtures) {
    if (f.status !== "FINISHED" || !f.score) continue;
    const h = rows.get(f.home)!;
    const a = rows.get(f.away)!;
    const { home: hg, away: ag } = f.score;
    h.played++; a.played++;
    h.goalsFor += hg; h.goalsAgainst += ag;
    a.goalsFor += ag; a.goalsAgainst += hg;
    if (hg > ag) { h.won++; h.points += 3; a.lost++; }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  const list = [...rows.values()].map((r) => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }));
  list.sort((x, y) => y.points - x.points || y.goalDiff - x.goalDiff || y.goalsFor - x.goalsFor || x.team.name.localeCompare(y.team.name, "fr"));
  list.forEach((r, i) => (r.position = i + 1));
  return list;
}

const tz = "Africa/Kinshasa";
export const formatMatchDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: tz }).format(new Date(iso));
export const formatMatchDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date(iso));
export const formatMatchTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso)).replace(":", "h");
export const dayNumber = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: tz }).format(new Date(iso));
