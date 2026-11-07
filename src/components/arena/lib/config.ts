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
  /** Gardienne (et mur adverse féminin). */
  female?: boolean;
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
  cyan: { jersey: "#06b6d4", jersey2: "#0891b2", trim: "#082f49", shorts: "#082f49", socks: "#06b6d4", gloves: "#f8fafc", gloves2: "#0e7490" },
  teal: { jersey: "#14b8a6", jersey2: "#0f766e", trim: "#f8fafc", shorts: "#134e4a", socks: "#14b8a6", gloves: "#f8fafc", gloves2: "#0f172a" },
  violet: { jersey: "#8b5cf6", jersey2: "#5b21b6", trim: "#facc15", shorts: "#1e1b4b", socks: "#8b5cf6", gloves: "#facc15", gloves2: "#1e1b4b" },
  rose: { jersey: "#ec4899", jersey2: "#be185d", trim: "#18181b", shorts: "#18181b", socks: "#ec4899", gloves: "#f8fafc", gloves2: "#9d174d" },
  vert: { jersey: "#10b981", jersey2: "#047857", trim: "#022c22", shorts: "#022c22", socks: "#10b981", gloves: "#f8fafc", gloves2: "#065f46" },
  or: { jersey: "#eab308", jersey2: "#ca8a04", trim: "#422006", shorts: "#422006", socks: "#eab308", gloves: "#f8fafc", gloves2: "#a16207" },
  rouge: { jersey: "#dc2626", jersey2: "#991b1b", trim: "#450a0a", shorts: "#450a0a", socks: "#dc2626", gloves: "#f8fafc", gloves2: "#7f1d1d" },
  noir: { jersey: "#1f2937", jersey2: "#030712", trim: "#f4c400", shorts: "#030712", socks: "#1f2937", gloves: "#f4c400", gloves2: "#111827" },
  blanc: { jersey: "#f8fafc", jersey2: "#cbd5e1", trim: "#0f172a", shorts: "#0f172a", socks: "#f8fafc", gloves: "#38bdf8", gloves2: "#0284c7" },
  bleuRoi: { jersey: "#2563eb", jersey2: "#1d4ed8", trim: "#facc15", shorts: "#172554", socks: "#2563eb", gloves: "#facc15", gloves2: "#1e3a8a" }
};

export const FOOT_STAGES: FootStage[] = [
  {
    id: 1,
    name: "Entraînement",
    place: "Centre de formation · Kinshasa",
    pitch: "Penalty à 11 m · prise en main",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 10,
    keeper: { reaction: 0.28, read: 0.28, reach: 1.45, stay: 0.1, learn: 0, kit: K.orange, nickname: "Le Remplaçant" }
  },
  {
    id: 2,
    name: "Match amical",
    place: "Stade Tata Raphaël",
    pitch: "Penalty à 11 m · gardien attentif",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 9.5,
    keeper: { reaction: 0.23, read: 0.36, reach: 1.55, stay: 0.12, learn: 0.4, kit: K.lime, nickname: "Le Chat" }
  },
  {
    id: 3,
    name: "Tournoi de Kinshasa",
    place: "Stade Tata Raphaël",
    pitch: "Penalty décentré · pression du public",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 1.2,
    wall: 0,
    clock: 9,
    keeper: { reaction: 0.20, read: 0.44, reach: 1.65, stay: 0.12, learn: 0.8, kit: K.cyan, nickname: "Le Réflexe" }
  },
  {
    id: 4,
    name: "Premier Coup Franc",
    place: "Stade des Martyrs",
    pitch: "Coup franc à 18 m · mur de 3 joueurs",
    shots: 5,
    toPass: 3,
    distance: 18,
    ballX: -2.2,
    wall: 3,
    clock: 8.5,
    keeper: { reaction: 0.19, read: 0.46, reach: 1.7, stay: 0.1, learn: 0.8, kit: K.teal, nickname: "Le Rempart" }
  },
  {
    id: 5,
    name: "Phase de groupes",
    place: "Coupe d'Afrique · Groupe B",
    pitch: "Penalty à 11 m · le gardien apprend tes tirs",
    shots: 5,
    toPass: 3,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 8,
    keeper: { reaction: 0.17, read: 0.52, reach: 1.75, stay: 0.14, learn: 1.4, kit: K.violet, nickname: "La Pieuvre", female: true }
  },
  {
    id: 6,
    name: "Coup franc d'angle",
    place: "Stade des Martyrs",
    pitch: "Coup franc à 20 m · excentré droit",
    shots: 5,
    toPass: 3,
    distance: 20,
    ballX: 3.5,
    wall: 4,
    clock: 8,
    keeper: { reaction: 0.16, read: 0.50, reach: 1.8, stay: 0.08, learn: 1.0, kit: K.rose, nickname: "L'Acrobate", female: true }
  },
  {
    id: 7,
    name: "Huitième de finale",
    place: "Coupe d'Afrique · Élimination",
    pitch: "Penalty sous haute tension · 4 buts exigés",
    shots: 5,
    toPass: 4,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 7.5,
    keeper: { reaction: 0.14, read: 0.56, reach: 1.85, stay: 0.14, learn: 1.6, kit: K.vert, nickname: "Le Faucon" }
  },
  {
    id: 8,
    name: "Le Mur compact",
    place: "Stade des Martyrs",
    pitch: "Coup franc à 22 m plein axe · mur de 4",
    shots: 5,
    toPass: 3,
    distance: 22,
    ballX: -0.5,
    wall: 4,
    clock: 7.5,
    keeper: { reaction: 0.14, read: 0.54, reach: 1.88, stay: 0.1, learn: 1.2, kit: K.or, nickname: "Le Lion d'Or" }
  },
  {
    id: 9,
    name: "Quart de finale",
    place: "Coupe d'Afrique · Tempête",
    pitch: "Coup franc à 24 m · mur de 4 sautant",
    shots: 5,
    toPass: 3,
    distance: 24,
    ballX: -3.2,
    wall: 4,
    clock: 7,
    keeper: { reaction: 0.13, read: 0.58, reach: 1.9, stay: 0.12, learn: 1.5, kit: K.rouge, nickname: "Le Condor" }
  },
  {
    id: 10,
    name: "La Frayeur des Martyrs",
    place: "Stade des Martyrs · 80 000 supporters",
    pitch: "Penalty à 11 m · gardien ultra-rapide",
    shots: 5,
    toPass: 4,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 6.5,
    keeper: { reaction: 0.11, read: 0.62, reach: 1.95, stay: 0.15, learn: 2.0, kit: K.noir, nickname: "Le Mur" }
  },
  {
    id: 11,
    name: "Lucarne opposée",
    place: "Coupe d'Afrique",
    pitch: "Coup franc à 25 m excentré · mur de 5",
    shots: 5,
    toPass: 3,
    distance: 25,
    ballX: 4.2,
    wall: 5,
    clock: 6.5,
    keeper: { reaction: 0.12, read: 0.60, reach: 1.98, stay: 0.08, learn: 1.8, kit: K.blanc, nickname: "La Dame Blanche", female: true }
  },
  {
    id: 12,
    name: "Demi-finale",
    place: "Coupe d'Afrique · Choc des géants",
    pitch: "Coup franc à 26 m · mur de 5 compact",
    shots: 5,
    toPass: 3,
    distance: 26,
    ballX: -2.8,
    wall: 5,
    clock: 6,
    keeper: { reaction: 0.10, read: 0.64, reach: 2.02, stay: 0.12, learn: 2.1, kit: K.bleuRoi, nickname: "Le Géant du Fleuve" }
  },
  {
    id: 13,
    name: "Séance fatidique",
    place: "Stade des Martyrs",
    pitch: "Penalty à 11 m · arrêt obligatoire, 4 buts",
    shots: 5,
    toPass: 4,
    distance: 11,
    ballX: 0,
    wall: 0,
    clock: 5.5,
    keeper: { reaction: 0.09, read: 0.68, reach: 2.06, stay: 0.15, learn: 2.3, kit: K.violet, nickname: "L'Impassible", female: true }
  },
  {
    id: 14,
    name: "Missile longue distance",
    place: "Stade des Martyrs",
    pitch: "Coup franc à 28 m · mur de 5 défenseurs",
    shots: 5,
    toPass: 3,
    distance: 28,
    ballX: 1.8,
    wall: 5,
    clock: 5.5,
    keeper: { reaction: 0.085, read: 0.70, reach: 2.10, stay: 0.1, learn: 2.4, kit: K.or, nickname: "Le Titan de Kin" }
  },
  {
    id: 15,
    name: "Le Sacre Suprême",
    place: "Finale de Coupe d'Afrique · Martyrs en fusion",
    pitch: "Coup franc d'anthologie à 27 m · 4 buts exigés",
    shots: 5,
    toPass: 4,
    distance: 27,
    ballX: -3.8,
    wall: 5,
    clock: 5,
    keeper: { reaction: 0.075, read: 0.74, reach: 2.15, stay: 0.12, learn: 2.6, kit: K.noir, nickname: "La Légende Éternelle", female: true }
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
      nickname: ["Le Remplaçant", "Le Chat", "La Pieuvre", "Le Rempart", "Le Mur"][Math.min(4, Math.floor(k / 3))],
      female: Math.min(4, Math.floor(k / 3)) === 2
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
  /** Défenseure. */
  defenderFemale?: boolean;
  clock: number;
  /** Lieu : playground extérieur ou salle couverte. */
  venue: "street" | "arena";
}

const FT = { d: 4.6, a: 0, three: false, label: "Lancer franc" };
const PAINT_L = { d: 4.8, a: -0.28, three: false, label: "Intérieur gauche" };
const PAINT_R = { d: 4.8, a: 0.28, three: false, label: "Intérieur droit" };
const ELBOW_L = { d: 5.4, a: -0.42, three: false, label: "Coude gauche" };
const ELBOW_R = { d: 5.4, a: 0.42, three: false, label: "Coude droit" };
const BASE_L = { d: 5.8, a: -1.05, three: false, label: "Ligne de fond gauche" };
const BASE_R = { d: 5.8, a: 1.05, three: false, label: "Ligne de fond droite" };
const CORNER_L = { d: 6.75, a: -1.18, three: true, label: "Corner gauche · 3 pts" };
const CORNER_R = { d: 6.75, a: 1.18, three: true, label: "Corner droit · 3 pts" };
const WING_L = { d: 7.0, a: -0.72, three: true, label: "Aile gauche · 3 pts" };
const WING_R = { d: 7.0, a: 0.72, three: true, label: "Aile droite · 3 pts" };
const TOP = { d: 7.1, a: 0, three: true, label: "Tête de raquette · 3 pts" };
const DEEP_WING_L = { d: 8.2, a: -0.65, three: true, label: "Aile lointaine gauche · 3 pts" };
const DEEP_WING_R = { d: 8.2, a: 0.65, three: true, label: "Aile lointaine droite · 3 pts" };
const LOGO = { d: 9.2, a: 0, three: true, label: "Logo · 3 pts" };
const HALF_COURT = { d: 10.5, a: 0, three: true, label: "Milieu de terrain · 3 pts" };

export const BASKET_STAGES: BasketStage[] = [
  { id: 1, name: "Lancer franc", place: "Playground · Limete 7ᵉ Rue", pitch: "Ligne des lancers · sans défense", shots: 5, toPass: 3, spots: [FT, FT, FT, FT, FT], window: 0.095, defender: false, defenderJump: 9, clock: 10, venue: "street" },
  { id: 2, name: "Mi-distance", place: "Playground · Limete 7ᵉ Rue", pitch: "Coudes et raquette ouverts", shots: 5, toPass: 3, spots: [ELBOW_L, FT, ELBOW_R, PAINT_L, ELBOW_R], window: 0.084, defender: false, defenderJump: 9, clock: 9, venue: "street" },
  { id: 3, name: "Tour du périmètre", place: "Playground · Limete 7ᵉ Rue", pitch: "Lignes de fond et mi-distance", shots: 5, toPass: 3, spots: [BASE_L, ELBOW_L, FT, ELBOW_R, BASE_R], window: 0.076, defender: false, defenderJump: 9, clock: 8.5, venue: "street" },
  { id: 4, name: "Premier Opposant", place: "Playground · Limete 7ᵉ Rue", pitch: "Défenseur en place · déclenche vite", shots: 5, toPass: 3, spots: [ELBOW_L, FT, ELBOW_R, PAINT_R, ELBOW_L], window: 0.070, defender: true, defenderJump: 1.45, defenderFemale: true, clock: 8, venue: "street" },
  { id: 5, name: "Ligne à 3 points", place: "Playground · Limete 7ᵉ Rue", pitch: "Tirs primés sans contestation", shots: 5, toPass: 3, spots: [TOP, WING_L, WING_R, TOP, WING_L], window: 0.064, defender: false, defenderJump: 9, clock: 8, venue: "street" },
  { id: 6, name: "Closeout agressif", place: "Salle de Kinshasa", pitch: "Le défenseur sprinte et saute", shots: 5, toPass: 3, spots: [ELBOW_R, TOP, WING_L, ELBOW_L, WING_R], window: 0.060, defender: true, defenderJump: 1.25, clock: 7.5, venue: "arena" },
  { id: 7, name: "Corners de Limete", place: "Playground · Limete 7ᵉ Rue", pitch: "Tirs à 3 points en angle zéro", shots: 5, toPass: 3, spots: [CORNER_L, CORNER_R, CORNER_L, CORNER_R, TOP], window: 0.056, defender: false, defenderJump: 9, clock: 7.5, venue: "street" },
  { id: 8, name: "Chasseur de contres", place: "Salle de Kinshasa", pitch: "Défenseur rapide · timing serré", shots: 5, toPass: 3, spots: [WING_L, TOP, WING_R, ELBOW_L, CORNER_R], window: 0.053, defender: true, defenderJump: 1.10, defenderFemale: true, clock: 7, venue: "arena" },
  { id: 9, name: "Tour du Monde 3 Pts", place: "Salle de Kinshasa", pitch: "5 spots d'arc · 4 paniers exigés", shots: 5, toPass: 4, spots: [CORNER_L, WING_L, TOP, WING_R, CORNER_R], window: 0.049, defender: false, defenderJump: 9, clock: 7, venue: "arena" },
  { id: 10, name: "Roi du Playground", place: "Playground · Limete 7ᵉ Rue", pitch: "Défenseur rugueux · main au visage", shots: 5, toPass: 3, spots: [TOP, WING_L, LOGO, WING_R, TOP], window: 0.046, defender: true, defenderJump: 0.98, clock: 6.5, venue: "street" },
  { id: 11, name: "Deep Range", place: "Salle de Kinshasa", pitch: "Tirs très lointains (8.2 m)", shots: 5, toPass: 3, spots: [DEEP_WING_L, TOP, DEEP_WING_R, LOGO, DEEP_WING_L], window: 0.044, defender: false, defenderJump: 9, clock: 6.5, venue: "arena" },
  { id: 12, name: "Rideau de Fer", place: "Salle de Kinshasa", pitch: "Pivot de 2m05 · saut explosif", shots: 5, toPass: 4, spots: [WING_R, ELBOW_L, TOP, WING_L, LOGO], window: 0.042, defender: true, defenderJump: 0.88, clock: 6, venue: "arena" },
  { id: 13, name: "Clutch Time", place: "Playground · Limete 7ᵉ Rue", pitch: "5.5s au shot clock · 4/5 exigés", shots: 5, toPass: 4, spots: [CORNER_L, TOP, WING_R, DEEP_WING_L, LOGO], window: 0.039, defender: true, defenderJump: 0.82, defenderFemale: true, clock: 5.5, venue: "street" },
  { id: 14, name: "Le Mur de Mutombo", place: "Salle de Kinshasa", pitch: "Hommage à Dikembe · envergure légendaire", shots: 5, toPass: 4, spots: [TOP, WING_L, DEEP_WING_R, LOGO, HALF_COURT], window: 0.036, defender: true, defenderJump: 0.76, clock: 5.5, venue: "arena" },
  { id: 15, name: "Légende des Léopards", place: "Sommet de Kinshasa · Salle comble", pitch: "Le défi ultime : du logo face au meilleur", shots: 5, toPass: 4, spots: [WING_L, LOGO, WING_R, HALF_COURT, LOGO], window: 0.033, defender: true, defenderJump: 0.70, clock: 5, venue: "arena" }
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
  carriere: { label: "Carrière", hint: "15 paliers à débloquer, de l'initiation au sommet" },
  survie: { label: "Mort subite", hint: "Marque jusqu'au premier raté. Le gardien progresse." },
  chrono: { label: "Chrono 45 s", hint: "Un max de paniers avant la sirène" },
  duel: { label: "À plusieurs", hint: "2 à 4 joueurs, on se passe le téléphone" },
  defi: { label: "Défi", hint: "Bats le score de ton ami" }
};
