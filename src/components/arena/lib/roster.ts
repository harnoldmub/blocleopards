/** Personnages jouables : léger (aucune dépendance 3D), utilisable dans l'interface. */

export type Rig = "bip" | "mx";

export interface CharDef {
  id: string;
  label: string;
  female: boolean;
  rig: Rig;
  /** Fichier GLB (squelette Mixamo). */
  file?: string;
  cartoon?: boolean;
  /** Tenue non séparable (un seul maillage) : on garde la tenue d'origine. */
  ownOutfit?: boolean;
  /** Sans maillot officiel : pas de dossard ni numéro dans le dos. */
  noJersey?: boolean;
  skin: string;
  roleHint?: string;
}

/** Les personnages jouables (et adversaires). */
export const ROSTER: CharDef[] = [
  { id: "leopard", label: "Le Léopard", female: false, rig: "bip", skin: "#5a3520", roleHint: "Capitaine" },
  { id: "ilunga", label: "Ilunga", female: false, rig: "mx", file: "chars/ilunga.glb", skin: "#4a2c1a", roleHint: "Défenseur" },
  { id: "kabasele", label: "Kabasele", female: false, rig: "mx", file: "chars/kabasele.glb", ownOutfit: true, noJersey: true, skin: "#3d2416", roleHint: "Tenue civile" },
  { id: "mbala", label: "Mbala", female: false, rig: "mx", file: "chars/mbala.glb", noJersey: true, skin: "#7a4b2e", roleHint: "Attaquant" },
  { id: "ty", label: "Mundels", female: false, rig: "mx", file: "chars/ty.glb", cartoon: true, ownOutfit: true, noJersey: true, skin: "#7a4b2e", roleHint: "Streetwear" },
  { id: "leoparde", label: "La Léoparde", female: true, rig: "bip", skin: "#6b4128", roleHint: "Capitaine" },
  { id: "grace", label: "Dee", female: true, rig: "mx", file: "chars/grace.glb", skin: "#c69a7a", roleHint: "Meneuse" },
  { id: "nadege", label: "Nadège", female: true, rig: "mx", file: "chars/nadege.glb", ownOutfit: true, noJersey: true, skin: "#c69a7a", roleHint: "Tenue civile" },
  { id: "megan", label: "Megan", female: true, rig: "mx", file: "chars/megan.glb", noJersey: true, skin: "#c69a7a", roleHint: "Pivot" },
  { id: "amy", label: "Métiola", female: true, rig: "mx", file: "chars/amy.glb", cartoon: true, ownOutfit: true, noJersey: true, skin: "#e5b49a", roleHint: "Tenue civile" }
];

export const charById = (id?: string | null) => ROSTER.find((c) => c.id === id) || null;

/** Détermine si un personnage porte un maillot officiel ou une tenue civile/propre. */
export function hasJersey(charOrId?: CharDef | string | null): boolean {
  if (!charOrId) return true;
  const def = typeof charOrId === "string" ? charById(charOrId) : charOrId;
  return !def?.noJersey && !def?.ownOutfit;
}

/** Personnage d'un sexe donné, choisi de façon déterministe (et différent de « avoid »). */
export function pickChar(female: boolean, seed: number, avoid: string[] = []): CharDef {
  // adversaires : seulement des personnages qu'on peut habiller aux couleurs de l'équipe
  const ok = ROSTER.filter((c) => c.female === female && !c.ownOutfit && !c.cartoon);
  const pool = ok.filter((c) => !avoid.includes(c.id));
  const list = pool.length ? pool : ok;
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/** Personnage par défaut d'un sexe donné. */
export const defaultChar = (female: boolean) => (female ? "leoparde" : "leopard");

/** Personnage valide pour ce sexe (sinon celui par défaut). */
export function charFor(id: string | undefined | null, female: boolean) {
  const d = charById(id);
  return d && d.female === female ? d.id : defaultChar(female);
}
