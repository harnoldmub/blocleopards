/**
 * Manifeste et configuration du futur jeu de combat Léopards.
 * Référence toutes les animations FBX ajoutées dans public/game3d/combat/
 */

export type CombatMoveType = "attack" | "defense" | "reaction";

export interface CombatMove {
  id: string;
  name: string;
  file: string;
  type: CombatMoveType;
  damage?: number;
  blockPower?: number;
  durationEst: number; // en secondes
  description: string;
}

/** Catalogue des techniques de combat Léopards prêtes pour le moteur 3D. */
export const COMBAT_MOVES: Record<string, CombatMove> = {
  jab: {
    id: "jab",
    name: "Lead Jab",
    file: "combat/lead-jab.fbx",
    type: "attack",
    damage: 12,
    durationEst: 0.65,
    description: "Coup direct rapide du bras avant pour maintenir la distance."
  },
  punch: {
    id: "punch",
    name: "Coup de poing puissant",
    file: "combat/punching.fbx",
    type: "attack",
    damage: 24,
    durationEst: 0.95,
    description: "Enchaînement puissant de coups de poing directs et crochets."
  },
  elbow: {
    id: "elbow",
    name: "Coude Percutant",
    file: "combat/illegal-elbow-punch.fbx",
    type: "attack",
    damage: 32,
    durationEst: 1.1,
    description: "Coup de coude circulaire dévastateur au corps à corps."
  },
  headbutt: {
    id: "headbutt",
    name: "Coup de Tête",
    file: "combat/headbutt.fbx",
    type: "attack",
    damage: 28,
    durationEst: 0.85,
    description: "Coup de tête rapproché brisant la garde adverse."
  },
  flyingKneeCombo: {
    id: "flyingKneeCombo",
    name: "Combo Genou Sauté & Poings",
    file: "combat/flying-knee-punch-combo.fbx",
    type: "attack",
    damage: 45,
    durationEst: 1.8,
    description: "Attaque spéciale aérienne avec coup de genou sauté et enchaînement au sol."
  },
  block: {
    id: "block",
    name: "Parade Centrale",
    file: "combat/center-block.fbx",
    type: "defense",
    blockPower: 80,
    durationEst: 1.2,
    description: "Garde haute compacte absorbant les frappes adverses."
  },
  headHit: {
    id: "headHit",
    name: "Impact Tête Subi",
    file: "combat/head-hit.fbx",
    type: "reaction",
    durationEst: 0.8,
    description: "Réaction d'encaissement suite à un coup direct au visage."
  }
};

