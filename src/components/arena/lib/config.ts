/**
 * Arène des Léopards — configuration des paliers, difficultés et barème.
 * Tout ce qui règle l'équilibrage du jeu vit ici.
 */

export type GameId = "foot" | "basket";
export type Difficulty = "facile" | "pro" | "legende";
export type Mode = "carriere" | "survie" | "chrono" | "duel" | "defi";

export interface DiffCfg {
  id: Difficulty;
  label: string;
  hint: string;
  scoreMult: number;
  /** Bruit de visée (multiplicateur). */
  aimNoise: number;
  /** Gardien : réaction (mult), lecture (mult), portée (mult). */
  keeperReaction: number;
  keeperRead: number;
  keeperReach: number;
  /** Basket : largeur de la zone verte (mult). */
  window: number;
  /** Aide visuelle (cible fantôme / trajectoire). */
  assist: boolean;
  /** Chrono par tir (mult) ; 0 = pas de chrono. */
  clock: number;
}

export const DIFFS: Record<Difficulty, DiffCfg> = {
  facile: {
    id: "facile",
    label: "Facile",
    hint: "Visée assistée, gardien lent, pas de chrono",
    scoreMult: 1,
    aimNoise: 0.55,
    keeperReaction: 1.45,
    keeperRead: 0.55,
    keeperReach: 0.9,
    window: 1.45,
    assist: true,
    clock: 0
  },
  pro: {
    id: "pro",
    label: "Pro",
    hint: "Le vrai match : chrono et gardien attentif",
    scoreMult: 1.5,
    aimNoise: 1,
    keeperReaction: 1,
    keeperRead: 1,
    keeperReach: 1,
    window: 1,
    assist: false,
    clock: 1
  },
  legende: {
    id: "legende",
    label: "Légende",
    hint: "Gardien qui lit ton jeu, zéro marge d'erreur",
    scoreMult: 2,
    aimNoise: 1.35,
    keeperReaction: 0.78,
    keeperRead: 1.35,
    keeperReach: 1.08,
    window: 0.72,
    assist: false,
    clock: 0.8
  }
};

export interface KeeperCfg {
  /** Délai de réaction après la frappe (s). */
  reaction: number;
  /** Probabilité de lire la vraie direction. */
  read: number;
  /** Poussée latérale maximale du plongeon (m). */
  reach: number;
  /** Probabilité de rester au centre. */
  stay: number;
  /** Poids donné à l'historique du tireur (0 = aucun). */
  learn: number;
  kit: { jersey: string; jersey2: string; trim: string; shorts: string; socks: string; gloves: string; gloves2: string };
  nickname: string;
}

export interface FootStage {
  id: number;
  name: string;
  place: string;
  pitch: string;
  shots: number;
  toPass: number;
  /** Distance du ballon à la ligne de but (m). */
  distance: number;
  ballX: number;
  wall: number;
  clock: number;
  keeper: KeeperCfg;
}

const K = {
  orange: { jersey: "#f97316", jersey2: "#c2410c", trim: "#111827", shorts: "#111827", socks: "#f97316", gloves: "#f8fafc", gloves2: "#f97316" },
  lime: { jersey: "#a3e635", jersey2: "#4d7c0f", trim: "#0f172a", shorts: "#0f172a", socks: "#a3e635", gloves: "#f8fafc", gloves2: "#16a34a" },
  violet: { jersey: "#8b5cf6", jersey2: "#5b21b6", trim: "#facc15", shorts: "#1e1b4b", socks: "#8b5cf6", gloves: "#facc15", gloves2: "#1e1b4b" },
  teal: { jersey: "#14b8a6", jersey2: "#0f766e", trim: "#f8fafc", shorts: "#134e4a", socks: "#14b8a6", gloves: "#f8fafc", gloves2: "#0f172a" },
  noir: { jersey: "#1f2937", jersey2: "#030712", trim: "#f4c400", shorts: "#030712", socks: "#1f2937", gloves: "#f4c400", gloves2: "#111827" }
};

export const FOOT_STAGES: FootStage[] = [
  {
    id: 1,
    name: "Entraînement",
    place: "Centre de formation · Kinshasa",
    pitch: "Penalty à 11 m",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 10,
    keeper: { reaction: 0.26, read: 0.3, reach: 1.45, stay: 0.1, learn: 0, kit: K.orange, nickname: "Le Remplaçant" }
  },
  {
    id: 2,
    name: "Match amical",
    place: "Stade Tata Raphaël",
    pitch: "Penalty à 11 m",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 9,
    keeper: { reaction: 0.2, read: 0.42, reach: 1.6, stay: 0.12, learn: 0.6, kit: K.lime, nickname: "Le Chat" }
  },
  {
    id: 3,
    name: "Phase de groupes",
    place: "Coupe d'Afrique · Groupe B",
    pitch: "Penalty · le gardien apprend",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 8,
    keeper: { reaction: 0.15, read: 0.52, reach: 1.75, stay: 0.14, learn: 1.4, kit: K.violet, nickname: "La Pieuvre" }
  },
  {
    id: 4,
    name: "Quart de finale",
    place: "Coup franc direct",
    pitch: "Coup franc à 20 m · mur de 4",
    shots: 5,
    toPass: 2,
    distance: 20,
    ballX: -2.5,
    wall: 4,
    clock: 9,
    keeper: { reaction: 0.17, read: 0.5, reach: 1.8, stay: 0.08, learn: 0.8, kit: K.teal, nickname: "Le Rempart" }
  },
  {
    id: 5,
    name: "Finale",
    place: "Stade des Martyrs · 80 000 places",
    pitch: "Tirs au but · gardien d'élite",
    shots: 5,
    toPass: 4,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 7,
    keeper: { reaction: 0.1, read: 0.62, reach: 1.95, stay: 0.15, learn: 2, kit: K.noir, nickname: "Le Mur" }
  }
];

/** Mode duel / défi : penalty de niveau intermédiaire, identique pour tous. */
export const FOOT_DUEL: FootStage = {
  ...FOOT_STAGES[2],
  id: 0,
  name: "Séance de tirs au but",
  place: "Stade des Martyrs",
  pitch: "5 tirs chacun · même gardien",
  toPass: 0
};

/** Mort subite : le gardien progresse à chaque but. */
export function survivalStage(goals: number): FootStage {
  const k = Math.min(goals, 14);
  return {
    ...FOOT_STAGES[0],
    id: -1,
    name: "Mort subite",
    place: "Stade des Martyrs",
    pitch: `Gardien niveau ${k + 1}`,
    shots: 999,
    toPass: 0,
    clock: Math.max(6, 10 - k * 0.3),
    keeper: {
      reaction: Math.max(0.1, 0.26 - k * 0.014),
      read: Math.min(0.7, 0.28 + k * 0.035),
      reach: Math.min(1.95, 1.45 + k * 0.04),
      stay: 0.12,
      learn: Math.min(2, k * 0.2),
      kit: [K.orange, K.lime, K.violet, K.teal, K.noir][Math.min(4, Math.floor(k / 3))],
      nickname: ["Le Remplaçant", "Le Chat", "La Pieuvre", "Le Rempart", "Le Mur"][Math.min(4, Math.floor(k / 3))]
    }
  };
}

export interface BasketStage {
  id: number;
  name: string;
  place: string;
  pitch: string;
  shots: number;
  toPass: number;
  /** Positions de tir : distance au panier (m) et angle (rad, 0 = face). */
  spots: { d: number; a: number; three: boolean; label: string }[];
  /** Demi-largeur de la zone verte (en fraction de jauge). */
  window: number;
  defender: boolean;
  /** Délai avant que le défenseur ne saute (s). */
  defenderJump: number;
  clock: number;
  /** Lieu : playground extérieur ou salle couverte. */
  venue: "street" | "arena";
}

const FT = { d: 4.6, a: 0, three: false, label: "Lancer franc" };
const ELBOW_L = { d: 5.4, a: -0.42, three: false, label: "Coude gauche" };
const ELBOW_R = { d: 5.4, a: 0.42, three: false, label: "Coude droit" };
const WING_L = { d: 7, a: -0.72, three: true, label: "Aile gauche · 3 pts" };
const WING_R = { d: 7, a: 0.72, three: true, label: "Aile droite · 3 pts" };
const TOP = { d: 7.1, a: 0, three: true, label: "Tête de raquette · 3 pts" };
const LOGO = { d: 9.2, a: 0, three: true, label: "Logo · 3 pts" };

export const BASKET_STAGES: BasketStage[] = [
  { id: 1, name: "Lancer franc", place: "Playground · Limete 7ᵉ Rue", pitch: "Ligne des lancers · sans défense", shots: 5, toPass: 3, spots: [FT, FT, FT, FT, FT], window: 0.095, defender: false, defenderJump: 9, clock: 10, venue: "street" },
  { id: 2, name: "Mi-distance", place: "Playground · Limete 7ᵉ Rue", pitch: "Coudes de la raquette", shots: 5, toPass: 3, spots: [ELBOW_L, FT, ELBOW_R, ELBOW_L, ELBOW_R], window: 0.072, defender: false, defenderJump: 9, clock: 8, venue: "street" },
  { id: 3, name: "Ligne à 3 points", place: "Playground · Limete 7ᵉ Rue", pitch: "Tirs primés depuis l'arc", shots: 5, toPass: 3, spots: [TOP, WING_L, WING_R, TOP, WING_L], window: 0.06, defender: false, defenderJump: 9, clock: 8, venue: "street" },
  { id: 4, name: "Sous pression", place: "Salle de Kinshasa", pitch: "Un défenseur saute : tire vite", shots: 5, toPass: 3, spots: [ELBOW_R, TOP, WING_L, ELBOW_L, WING_R], window: 0.058, defender: true, defenderJump: 1.25, clock: 7, venue: "arena" },
  { id: 5, name: "Buzzer beater", place: "Finale · Salle de Kinshasa", pitch: "Du logo, défenseur collé", shots: 5, toPass: 3, spots: [TOP, WING_R, LOGO, WING_L, LOGO], window: 0.046, defender: true, defenderJump: 0.95, clock: 6, venue: "arena" }
];

export const BASKET_DUEL: BasketStage = {
  ...BASKET_STAGES[2],
  id: 0,
  name: "Duel en salle",
  place: "Salle de Kinshasa",
  venue: "arena",
  pitch: "5 tirs chacun · mêmes positions",
  spots: [FT, ELBOW_L, TOP, WING_R, LOGO],
  toPass: 0
};

/** Chrono : positions qui tournent, ballon d'or tous les 5 tirs. */
export const BASKET_CHRONO: BasketStage = {
  id: -2,
  name: "Chrono 45 s",
  place: "Limete 7ᵉ Rue",
  pitch: "Un max de paniers · +2 s par swish",
  shots: 999,
  toPass: 0,
  spots: [FT, ELBOW_L, ELBOW_R, TOP, WING_L, WING_R, FT, LOGO],
  window: 0.075,
  defender: false,
  defenderJump: 9,
  clock: 0,
  venue: "street"
};

export const CHRONO_SECONDS = 45;

/** Multiplicateur de combo : x1, x1.25, x1.5, x2, x2.5 (plafond). */
export function comboMult(streak: number): number {
  if (streak <= 1) return 1;
  return Math.min(2.5, [1, 1, 1.25, 1.5, 2, 2.5][Math.min(streak, 5)]);
}

/** Étoiles d'une série selon les réussites. */
export function starsFor(made: number, shots: number, toPass: number): number {
  if (made < toPass) return 0;
  if (made >= shots) return 3;
  if (made >= Math.min(shots - 1, toPass + 1)) return 2;
  return 1;
}

export const GAME_META: Record<GameId, { title: string; short: string; place: string; modes: Mode[] }> = {
  foot: { title: "Tirs au but", short: "Foot", place: "Stade des Martyrs", modes: ["carriere", "survie"] },
  basket: { title: "Shoot à la sirène", short: "Basket", place: "Limete 7ᵉ Rue", modes: ["carriere", "chrono"] }
};

export const MODE_META: Record<Mode, { label: string; hint: string }> = {
  carriere: { label: "Carrière", hint: "5 paliers à débloquer, jusqu'à la finale" },
  survie: { label: "Mort subite", hint: "Marque jusqu'au premier raté. Le gardien progresse." },
  chrono: { label: "Chrono 45 s", hint: "Un max de paniers avant la sirène" },
  duel: { label: "À plusieurs", hint: "2 à 4 joueurs, on se passe le téléphone" },
  defi: { label: "Défi", hint: "Bats le score de ton ami" }
};
