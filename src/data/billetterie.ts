/**
 * Configuration unique de la billetterie (page publique, API, vérification,
 * liste d'émargement). Pour passer à un autre match, ne modifier que ce fichier.
 *
 * Les tarifs, la limite par commande et le point de retrait sont ceux déjà en
 * place : ne pas les changer sans confirmation de l'organisation.
 */
export const billetterie = {
  /**
   * Liens vers /billetterie affichés sur le site (accueil, gagnants…).
   * À `false`, ils sont masqués partout ; la page reste accessible par son URL.
   */
  showLinks: false,

  competition: "Éliminatoires CAN 2027",
  round: "Journée 3",
  group: "Groupe E",

  home: { code: "RDC", name: "RD Congo", nickname: "Les Léopards", flag: "/flags/cd.svg" },
  away: { code: "SLE", name: "Sierra Leone", nickname: "Leone Stars", flag: "/flags/sl.svg" },

  /** Coup d'envoi, heure de Kinshasa (UTC+1). */
  kickoff: "2026-11-12T17:00:00+01:00",
  dateLong: "Jeudi 12 novembre 2026",
  dateShort: "Jeu. 12 nov. 2026",
  time: "17:00",
  venue: "Stade des Martyrs",
  city: "Kinshasa",

  ticket: {
    name: "Standard",
    detail: "Tribune latérale · Placement libre",
    unitPriceFc: 69000,
    maxPerOrder: 4,
  },

  pickup: {
    place: "Stade Tata Raphaël",
    time: "10 h",
    payment: "Paiement sur place lors du retrait",
  },

  /**
   * Début de la période de réservation de ce match. Les réservations plus
   * anciennes (match précédent) restent en base et dans l'admin, mais ne
   * comptent plus dans les places restantes ni dans la liste d'émargement.
   */
  reservationsSince: "2026-09-29T00:00:00+01:00",
} as const;

export const matchLabel = `${billetterie.home.code} – ${billetterie.away.name}`;
export const matchDateTime = `${billetterie.dateLong} · ${billetterie.time}`;
export const matchPlace = `${billetterie.venue} · ${billetterie.city}`;

/**
 * Matchs gérés par la billetterie, du plus récent au plus ancien. Une
 * réservation est rattachée à un match par sa date de création : `from` inclus,
 * `to` exclu. Pour un nouveau match, ajouter une ligne en tête et fermer la
 * période du précédent avec `to`.
 */
export const billetterieMatches = [
  {
    key: "sierra-leone-2026-11",
    label: "RD Congo – Sierra Leone",
    date: "Jeu. 12 nov. 2026 · 17:00",
    venue: "Stade des Martyrs · Kinshasa",
    from: billetterie.reservationsSince as string | null,
    to: null as string | null,
    current: true,
  },
  {
    key: "guinee-equatoriale-2026-09",
    label: "RD Congo – Guinée équatoriale",
    date: "Jeu. 24 sept. 2026 · 17:00",
    venue: "Stade des Martyrs · Kinshasa",
    from: null as string | null,
    to: billetterie.reservationsSince as string | null,
    current: false,
  },
];

export function matchKeyFor(createdAt: string | Date): string {
  const t = new Date(createdAt).getTime();
  const found = billetterieMatches.find(
    (m) => (!m.from || t >= Date.parse(m.from)) && (!m.to || t < Date.parse(m.to))
  );
  return (found ?? billetterieMatches[0]).key;
}
