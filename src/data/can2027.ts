/**
 * Structure de données centrale pour la campagne « Éliminatoires CAN 2027 ».
 * Mise à jour facile et centralisée pour les scores, classements, calendriers et effectifs.
 */

export interface TeamStanding {
  position: number;
  name: string;
  shortName: string;
  code: string;
  flag: string;
  isRDC?: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export type MatchStatus = "UPCOMING" | "LIVE" | "FINISHED";

export interface GoalScorer {
  player: string;
  minute: string;
  team: string; // 'RDC' or opponent code
}

export interface MatchStats {
  possession?: [number, number]; // [home, away] en %
  shots?: [number, number];
  shotsOnTarget?: [number, number];
  corners?: [number, number];
  fouls?: [number, number];
}

export interface MatchFixture {
  id: string;
  matchday: number; // 1 to 6
  matchdayLabel: string;
  dateStr: string;
  timeStr: string;
  venue: string;
  city: string;
  country: string;
  homeTeam: {
    name: string;
    shortName: string;
    code: string;
    flag: string;
    isRDC?: boolean;
  };
  awayTeam: {
    name: string;
    shortName: string;
    code: string;
    flag: string;
    isRDC?: boolean;
  };
  status: MatchStatus;
  score?: {
    home: number;
    away: number;
  };
  scorers?: GoalScorer[];
  summary?: string;
  stats?: MatchStats;
  articleUrl?: string;
  videoUrl?: string;
  galleryUrl?: string;
  isConfirmed: boolean;
}

export interface CalendarWindow {
  matchdays: string;
  windowStr: string;
  notes: string;
  isConfirmed: boolean;
}

export interface Player {
  id: string;
  name: string; // e.g. "M. EPOLO"
  firstName?: string;
  lastName?: string;
  number?: number;
  position: "Gardien" | "Défenseur" | "Milieu" | "Attaquant";
  club: string;
  photo?: string;
  featured?: boolean;
  quote?: string;
}

export interface SquadStage {
  id: string;
  title: string;
  subtitle: string;
  dates: string;
  badge: string;
  coach: string;
  matches: {
    label: string;
    date: string;
    venue: string;
  }[];
  players: Player[];
}

export interface BaseTeam {
  name: string;
  shortName: string;
  code: string;
  flag: string;
  isRDC?: boolean;
}

export const GROUP_E_TEAMS: BaseTeam[] = [
  { name: "RD Congo", shortName: "RDC", code: "RDC", flag: "/flags/cd.svg", isRDC: true },
  { name: "Guinée équatoriale", shortName: "Guinée éq.", code: "GQ", flag: "/flags/gq.svg", isRDC: false },
  { name: "Sierra Leone", shortName: "Sierra Leone", code: "SL", flag: "/flags/sl.svg", isRDC: false },
  { name: "Zimbabwe", shortName: "Zimbabwe", code: "ZW", flag: "/flags/zw.svg", isRDC: false }
];

/**
 * Calcule automatiquement le classement officiel à partir des résultats des matchs.
 * Applique les règles officielles CAF : Points > Différence de buts > Buts marqués > Confrontation/Ordre.
 */
export function computeStandings(teams: BaseTeam[], matches: MatchFixture[]): TeamStanding[] {
  const statsMap = new Map<string, {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }>();

  for (const team of teams) {
    statsMap.set(team.code, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    });
  }

  for (const match of matches) {
    if (match.status === "FINISHED" && match.score) {
      const homeStats = statsMap.get(match.homeTeam.code);
      const awayStats = statsMap.get(match.awayTeam.code);

      if (homeStats && awayStats) {
        const hG = match.score.home;
        const aG = match.score.away;

        homeStats.played += 1;
        awayStats.played += 1;
        homeStats.goalsFor += hG;
        homeStats.goalsAgainst += aG;
        awayStats.goalsFor += aG;
        awayStats.goalsAgainst += hG;

        if (hG > aG) {
          homeStats.won += 1;
          homeStats.points += 3;
          awayStats.lost += 1;
        } else if (hG < aG) {
          awayStats.won += 1;
          awayStats.points += 3;
          homeStats.lost += 1;
        } else {
          homeStats.drawn += 1;
          homeStats.points += 1;
          awayStats.drawn += 1;
          awayStats.points += 1;
        }
      }
    }
  }

  const standings: TeamStanding[] = teams.map((team) => {
    const s = statsMap.get(team.code)!;
    return {
      position: 0,
      name: team.name,
      shortName: team.shortName,
      code: team.code,
      flag: team.flag,
      isRDC: team.isRDC,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDiff: s.goalsFor - s.goalsAgainst,
      points: s.points
    };
  });

  // Tri réglementaire CAF
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (a.isRDC) return -1;
    if (b.isRDC) return 1;
    return a.name.localeCompare(b.name);
  });

  standings.forEach((team, idx) => {
    team.position = idx + 1;
  });

  return standings;
}

export const CAN2027_DATA = {
  campaign: {
    surtitre: "ÉLIMINATOIRES CAN 2027",
    titrePrincipal: "LES LÉOPARDS",
    signature: "Tour oyo biso nde",
    signatureMeaning: "Cette fois, c'est notre tour",
    slogan: "Eloko ya makasi",
    hashtag: "#CAN2027",
    groupName: "GROUPE E"
  },

  // Classement calculé dynamiquement
  get groupE(): TeamStanding[] {
    return computeStandings(GROUP_E_TEAMS, this.fixtures);
  },

  // Matchs programmés des éliminatoires
  fixtures: [
    {
      id: "can2027-j1-rdc-gq",
      matchday: 1,
      matchdayLabel: "Journée 1",
      dateStr: "Jeudi 24 septembre 2026",
      timeStr: "17:00 (Kinshasa)",
      venue: "Stade des Martyrs",
      city: "Kinshasa",
      country: "RD Congo",
      homeTeam: {
        name: "République Démocratique du Congo",
        shortName: "RD Congo",
        code: "RDC",
        flag: "/flags/cd.svg",
        isRDC: true
      },
      awayTeam: {
        name: "Guinée équatoriale",
        shortName: "Guinée éq.",
        code: "GQ",
        flag: "/flags/gq.svg",
        isRDC: false
      },
      status: "UPCOMING",
      isConfirmed: true
    },
    {
      id: "can2027-j2-zw-rdc",
      matchday: 2,
      matchdayLabel: "Journée 2",
      dateStr: "Lundi 28 septembre 2026",
      timeStr: "18:00 (Heure locale)",
      venue: "National Sports Stadium",
      city: "Harare",
      country: "Zimbabwe",
      homeTeam: {
        name: "Zimbabwe",
        shortName: "Zimbabwe",
        code: "ZW",
        flag: "/flags/zw.svg",
        isRDC: false
      },
      awayTeam: {
        name: "République Démocratique du Congo",
        shortName: "RD Congo",
        code: "RDC",
        flag: "/flags/cd.svg",
        isRDC: true
      },
      status: "UPCOMING",
      isConfirmed: true
    }
  ] as MatchFixture[],

  // Calendrier complet des 6 journées
  campaignTimeline: [
    {
      matchday: 1,
      label: "Journée 1",
      dateStr: "24 septembre 2026",
      fixtureStr: "RDC – Guinée équatoriale",
      venueStr: "Stade des Martyrs, Kinshasa",
      status: "CONFIRMED",
      highlight: true
    },
    {
      matchday: 2,
      label: "Journée 2",
      dateStr: "28 septembre 2026",
      fixtureStr: "Zimbabwe – RDC",
      venueStr: "Harare",
      status: "CONFIRMED",
      highlight: true
    },
    {
      matchday: "J3 / J4",
      label: "Journées 3 & 4",
      dateStr: "9 → 17 novembre 2026",
      fixtureStr: "Fenêtre internationale",
      venueStr: "Rencontres précises communiquées prochainement",
      status: "WINDOW",
      highlight: false
    },
    {
      matchday: "J5 / J6",
      label: "Journées 5 & 6",
      dateStr: "22 → 30 mars 2027",
      fixtureStr: "Fenêtre internationale",
      venueStr: "Rencontres précises communiquées prochainement",
      status: "WINDOW",
      highlight: false
    }
  ],

  // Stages et listes officielles sélectionnées
  stages: [
    {
      id: "stage-elim-sept-2026",
      title: "Stage du 21 au 29 Septembre 2026",
      subtitle: "Éliminatoires CAN 2027 — Fenêtre FIFA",
      dates: "21 — 29 Septembre 2026",
      badge: "Éliminatoires CAN 2027",
      coach: "S. Desabre",
      matches: [
        { label: "RDC vs Sierra Leone", date: "Jeudi 24 Sept 2026", venue: "Stade des Martyrs (Kinshasa)" },
        { label: "Zimbabwe vs RDC", date: "Lundi 28 Sept 2026", venue: "National Sports Stadium (Harare)" }
      ],
      players: [
        // GARDIENS
        { id: "m-epolo", name: "M. EPOLO", position: "Gardien", club: "Standard Liège" },
        { id: "d-bertaud", name: "D. BERTAUD", position: "Gardien", club: "Forge FC" },
        { id: "n-ndibu", name: "N. NDIBU", position: "Gardien", club: "Les Aigles du Congo" },

        // DÉFENSEURS
        { id: "a-wan-bissaka", name: "A. WAN BISSAKA", position: "Défenseur", club: "Aston Villa" },
        { id: "g-kalulu", name: "G. KALULU", position: "Défenseur", club: "Aris Salonique" },
        { id: "k-pedro", name: "K. PEDRO", position: "Défenseur", club: "AS Saint-Étienne" },
        { id: "j-kayembe", name: "J. KAYEMBE", position: "Défenseur", club: "KRC Genk" },
        { id: "s-kapuadi", name: "S. KAPUADI", position: "Défenseur", club: "Widzew Łódź" },
        { id: "a-masuaku", name: "A. MASUAKU", position: "Défenseur", club: "Konyaspor" },
        { id: "j-makengo", name: "J. MAKENGO", position: "Défenseur", club: "SC Freiburg" },
        { id: "c-mbemba", name: "C. MBEMBA", position: "Défenseur", club: "Al Diriyah" },
        { id: "a-tuanzebe", name: "A. TUANZEBE", position: "Défenseur", club: "AJ Auxerre" },
        { id: "w-kambwala", name: "W. KAMBWALA", position: "Défenseur", club: "Côme 1907" },
        { id: "d-batubinsika", name: "D. BATUBINSIKA", position: "Défenseur", club: "FCSB (Bucarest)" },

        // MILIEUX
        { id: "n-sadiki", name: "N. SADIKI", position: "Milieu", club: "Sunderland AFC" },
        { id: "s-moutoussamy", name: "S. MOUTOUSSAMY", position: "Milieu", club: "Atromitos FC" },
        { id: "e-kayembe", name: "E. KAYEMBE", position: "Milieu", club: "Watford FC" },
        { id: "n-mukau", name: "N. MUKAU", position: "Milieu", club: "LOSC Lille" },
        { id: "n-mbamba", name: "N. MBAMBA", position: "Milieu", club: "FC Lorient" },
        { id: "e-banzuzi", name: "E. BANZUZI", position: "Milieu", club: "RB Leipzig" },
        { id: "n-mbuku", name: "N. MBUKU", position: "Milieu", club: "Saint-Trond VV" },
        { id: "b-cipenga", name: "B. CIPENGA", position: "Milieu", club: "UD Almería" },
        { id: "m-elia", name: "M. ELIA", position: "Milieu", club: "Alanyaspor" },
        { id: "t-bongonda", name: "T. BONGONDA", position: "Milieu", club: "Al Faisaly" },
        { id: "s-idumbo", name: "S. IDUMBO", position: "Milieu", club: "AS Monaco" },

        // ATTAQUANTS
        { id: "a-pululu", name: "A. PULULU", position: "Attaquant", club: "Al Hazem" },
        { id: "y-wissa", name: "Y. WISSA", position: "Attaquant", club: "Newcastle United" },
        { id: "s-banza", name: "S. BANZA", position: "Attaquant", club: "Al Jazira" },
        { id: "f-mayele", name: "F. MAYELE", position: "Attaquant", club: "Al-Ahli SC" }
      ]
    },
    {
      id: "stage-amical-oct-2026",
      title: "Stage du 28 Septembre au 06 Octobre 2026",
      subtitle: "Matchs Amicaux de Préparation",
      dates: "28 Septembre — 06 Octobre 2026",
      badge: "Matchs Amicaux",
      coach: "S. Desabre",
      matches: [
        { label: "RDC vs Ouganda", date: "Vendredi 02 Oct 2026", venue: "Match Amical" },
        { label: "Ouganda vs RDC", date: "Lundi 05 Oct 2026", venue: "Match Amical" }
      ],
      players: [
        // GARDIENS
        { id: "m-epolo-2", name: "M. EPOLO", position: "Gardien", club: "Standard Liège" },
        { id: "d-bertaud-2", name: "D. BERTAUD", position: "Gardien", club: "Forge FC" },
        { id: "n-ndibu-2", name: "N. NDIBU", position: "Gardien", club: "Les Aigles du Congo" },

        // DÉFENSEURS
        { id: "g-kalulu-2", name: "G. KALULU", position: "Défenseur", club: "Aris Salonique" },
        { id: "k-pedro-2", name: "K. PEDRO", position: "Défenseur", club: "AS Saint-Étienne" },
        { id: "j-kayembe-2", name: "J. KAYEMBE", position: "Défenseur", club: "KRC Genk" },
        { id: "s-kapuadi-2", name: "S. KAPUADI", position: "Défenseur", club: "Widzew Łódź" },
        { id: "j-makengo-2", name: "J. MAKENGO", position: "Défenseur", club: "SC Freiburg" },
        { id: "c-mbemba-2", name: "C. MBEMBA", position: "Défenseur", club: "Al Diriyah" },
        { id: "w-kambwala-2", name: "W. KAMBWALA", position: "Défenseur", club: "Côme 1907" },
        { id: "d-batubinsika-2", name: "D. BATUBINSIKA", position: "Défenseur", club: "FCSB (Bucarest)" },

        // MILIEUX
        { id: "n-sadiki-2", name: "N. SADIKI", position: "Milieu", club: "Sunderland AFC" },
        { id: "j-mokio-2", name: "J. MOKIO", position: "Milieu", club: "Ajax Amsterdam" },
        { id: "b-ndezi-2", name: "B. NDEZI", position: "Milieu", club: "Dijon FCO" },
        { id: "p-maghoma-2", name: "P. MAGHOMA", position: "Milieu", club: "Norwich City" },
        { id: "n-mbamba-2", name: "N. MBAMBA", position: "Milieu", club: "FC Lorient" },
        { id: "e-banzuzi-2", name: "E. BANZUZI", position: "Milieu", club: "RB Leipzig" },
        { id: "s-mavididi-2", name: "S. MAVIDIDI", position: "Milieu", club: "Watford FC" },
        { id: "j-kadile-2", name: "J. KADILE", position: "Milieu", club: "RC Lens" },
        { id: "s-idumbo-2", name: "S. IDUMBO", position: "Milieu", club: "AS Monaco" },

        // ATTAQUANTS
        { id: "a-musaba-2", name: "A. MUSABA", position: "Attaquant", club: "Norwich City" },
        { id: "j-muleka-2", name: "J. MULEKA", position: "Attaquant", club: "Konyaspor" },
        { id: "a-pululu-2", name: "A. PULULU", position: "Attaquant", club: "Al Hazem" },
        { id: "s-essende-2", name: "S. ESSENDE", position: "Attaquant", club: "BSC Young Boys" }
      ]
    }
  ] as SquadStage[],

  // Effectif officiel par défaut (Stage Éliminatoires CAN 2027)
  get squad(): Player[] {
    return this.stages[0].players;
  }
};
