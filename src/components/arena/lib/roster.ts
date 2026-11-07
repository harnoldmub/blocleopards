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
  skin: string;
}

/** Les personnages jouables (et adversaires). */
export const ROSTER: CharDef[] = [
  { id: "leopard", label: "Le Léopard", female: false, rig: "bip", skin: "#5a3520" },
  { id: "ilunga", label: "Ilunga", female: false, rig: "mx", file: "chars/ilunga.glb", skin: "#4a2c1a" },
  { id: "kabasele", label: "Kabasele", female: false, rig: "mx", file: "chars/kabasele.glb", ownOutfit: true, skin: "#3d2416" },
  { id: "mbala", label: "Mbala", female: false, rig: "mx", file: "chars/mbala.glb", skin: "#7a4b2e" },
  { id: "ty", label: "Mundels", female: false, rig: "mx", file: "chars/ty.glb", cartoon: true, skin: "#7a4b2e" },
  { id: "leoparde", label: "La Léoparde", female: true, rig: "bip", skin: "#6b4128" },
  { id: "grace", label: "Dee", female: true, rig: "mx", file: "chars/grace.glb", skin: "#c69a7a" },
  { id: "nadege", label: "Nadège", female: true, rig: "mx", file: "chars/nadege.glb", skin: "#c69a7a" },
  { id: "megan", label: "Megan", female: true, rig: "mx", file: "chars/megan.glb", skin: "#c69a7a" },
  { id: "amy", label: "Métiola", female: true, rig: "mx", file: "chars/amy.glb", cartoon: true, ownOutfit: true, skin: "#e5b49a" }
];

export const charById = (id?: string | null) => ROSTER.find((c) => c.id === id) || null;

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
