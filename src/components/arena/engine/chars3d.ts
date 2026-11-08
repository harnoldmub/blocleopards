/**
 * Personnages 3D (modèle riggé + animations Mixamo) rendus par Three.js
 * au-dessus du décor 2D, avec exactement la même caméra.
 * Repère du jeu : x à droite, y en haut, z vers le but. Three : X = -x.
 */
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { charById, charFor, hasJersey, type CharDef } from "../lib/roster";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Camera } from "./scene";
import { computeSkin, type SkinInput } from "./skinTransfer";

/** Lance le transfert de peau dans un worker ; repli en direct si les workers sont indisponibles. */
function runSkin(input: SkinInput): Promise<{ skI: Uint16Array; skW: Float32Array }> {
  try {
    const w = new Worker(new URL("./skin.worker.ts", import.meta.url), { type: "module" });
    return new Promise((resolve) => {
      w.onmessage = (e) => {
        w.terminate();
        resolve(e.data);
      };
      w.onerror = () => {
        w.terminate();
        resolve(computeSkin(input));
      };
      w.postMessage(input);
    });
  } catch {
    return Promise.resolve(computeSkin(input));
  }
}

export type ClipName = "kick" | "dive" | "catch" | "scoop" | "twist" | "bboy" | "dribble" | "header" | "jump" | "side" | "miss" | "angry" | "defeated" | "clapping" | "praying";
const FILES: Record<"kick" | "dive" | "catch" | "scoop" | "twist" | "bboy" | "dribble", string> = {
  kick: "kick.fbx",
  dive: "dive.fbx",
  catch: "catch.fbx",
  scoop: "scoop.fbx",
  twist: "twist.fbx",
  bboy: "bboy.fbx",
  dribble: "dribble.fbx"
};
const BASE = "/game3d/";

export interface KitPaint {
  base: string;
  flames?: boolean;
  collar: string;
  cuff: string;
  shorts: string;
  socks: string;
  boots: string;
  name?: string;
  number?: string;
  numberColor: string;
  numberStroke: string;
  flag?: boolean;
  skin: string;
  gloves?: { main: string; strap: string };
  /** Débardeur de basket : les manches sont peintes couleur peau. */
  sleeveless?: boolean;
  /** Joueuse (modèle féminin). */
  female?: boolean;
}

export interface GameView {
  zoom: number;
  gx: number;
  gy: number;
  ox: number;
  oy: number;
}

/** Noms d'os canoniques, communs à tous les squelettes (alias posés sur chaque acteur). */
export const BONE = {
  root: "root",
  pelvis: "pelvis",
  spine: "spine",
  neck: "neck",
  head: "head",
  lUpper: "lUpper",
  lFore: "lFore",
  lHand: "lHand",
  rUpper: "rUpper",
  rFore: "rFore",
  rHand: "rHand",
  lThigh: "lThigh",
  lCalf: "lCalf",
  lFoot: "lFoot",
  rThigh: "rThigh",
  rCalf: "rCalf",
  rFoot: "rFoot",
  spine2: "spine2"
} as const;

export type { Rig } from "../lib/roster";
import type { Rig } from "../lib/roster";

/** Correspondance os canoniques → os réels de chaque squelette. */
export const RIG_BONES: Record<Rig, Record<keyof typeof BONE, string>> = {
  bip: {
    root: "Bip001", pelvis: "Bip001_Pelvis", spine: "Bip001_Spine1", spine2: "Bip001_Spine2", neck: "Bip001_Neck", head: "Bip001_Head",
    lUpper: "Bip001_L_UpperArm", lFore: "Bip001_L_Forearm", lHand: "Bip001_L_Hand",
    rUpper: "Bip001_R_UpperArm", rFore: "Bip001_R_Forearm", rHand: "Bip001_R_Hand",
    lThigh: "Bip001_L_Thigh", lCalf: "Bip001_L_Calf", lFoot: "Bip001_L_Foot",
    rThigh: "Bip001_R_Thigh", rCalf: "Bip001_R_Calf", rFoot: "Bip001_R_Foot"
  },
  mx: {
    root: "mx_Hips", pelvis: "mx_Hips", spine: "mx_Spine1", spine2: "mx_Spine2", neck: "mx_Neck", head: "mx_Head",
    lUpper: "mx_LeftArm", lFore: "mx_LeftForeArm", lHand: "mx_LeftHand",
    rUpper: "mx_RightArm", rFore: "mx_RightForeArm", rHand: "mx_RightHand",
    lThigh: "mx_LeftUpLeg", lCalf: "mx_LeftLeg", lFoot: "mx_LeftFoot",
    rThigh: "mx_RightUpLeg", rCalf: "mx_RightLeg", rFoot: "mx_RightFoot"
  }
};

/** Noms Mixamo normalisés : « mixamorig10:Hips » → « mx_Hips » (même nom quel que soit le préfixe). */
export const mxName = (n: string) => n.replace(/mixamorig\d*:?/g, "mx_");

export { ROSTER, charById, charFor, pickChar, defaultChar } from "../lib/roster";
export type { CharDef } from "../lib/roster";

/** Squelette classique : rôles sans fichier dédié → animation la plus proche. */
const BIP_FALLBACK: Partial<Record<ClipName, ClipName>> = {
  jump: "catch",
  header: "catch",
  side: "catch",
  miss: "catch",
  angry: "catch",
  defeated: "catch",
  clapping: "catch",
  praying: "catch"
};

/** Rôles d'animation → fichiers Mixamo (danses selon le sexe). */
const MX_ROLE: Record<string, { m: string; f: string }> = {
  kick: { m: "kick", f: "kick" },
  dive: { m: "dive-a", f: "dive-a" },
  catch: { m: "catch-c", f: "catch-c" },
  scoop: { m: "block-b", f: "block-b" },
  jump: { m: "catch-a", f: "catch-a" },
  twist: { m: "dance-arms", f: "dance-booty" },
  bboy: { m: "dance-wave", f: "dance-macarena" },
  header: { m: "header", f: "header" },
  side: { m: "side-a", f: "side-a" },
  miss: { m: "miss", f: "miss" },
  angry: { m: "angry", f: "angry" },
  defeated: { m: "defeated", f: "defeated" },
  clapping: { m: "clapping", f: "clapping" },
  praying: { m: "praying", f: "praying" }
};
const MX_FILES = [
  "kick",
  "dive-a",
  "catch-c",
  "catch-a",
  "block-b",
  "dance-arms",
  "dance-booty",
  "dance-wave",
  "dance-macarena",
  "header",
  "side-a",
  "miss",
  "angry",
  "defeated",
  "clapping",
  "praying"
];

/** Recolore un vêtement en gardant ses plis (luminance × couleur d'équipe). */
const tintCache = new Map<string, THREE.Texture>();
function tintTexture(src: THREE.Texture | null, color: string, key: string): THREE.Texture | null {
  const ck = key + color;
  const hit = tintCache.get(ck);
  if (hit) return hit;
  const im: any = src?.image;
  if (!im || !im.width) return null;
  const W = Math.min(512, im.width);
  const H = Math.min(512, im.height);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.drawImage(im, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H);
  const col = new THREE.Color(color);
  // gamma sRGB approx. pour la couleur cible
  const tr = Math.round(Math.pow(col.r, 1 / 2.2) * 255);
  const tg = Math.round(Math.pow(col.g, 1 / 2.2) * 255);
  const tb = Math.round(Math.pow(col.b, 1 / 2.2) * 255);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) sum += d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
  const mean = sum / (d.data.length / 4) || 128;
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    const k = Math.max(0.45, Math.min(1.25, 0.85 + (l - mean) / 160));
    d.data[i] = Math.min(255, tr * k);
    d.data[i + 1] = Math.min(255, tg * k);
    d.data[i + 2] = Math.min(255, tb * k);
  }
  c.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = src!.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = src!.wrapS;
  t.wrapT = src!.wrapT;
  tintCache.set(ck, t);
  return t;
}

/** Dossard (nom + numéro) collé dans le dos des personnages Mixamo. */
function backPlate(kit: KitPaint): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const c = cv.getContext("2d")!;
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (kit.name) {
    c.font = "800 34px Sora, system-ui, sans-serif";
    c.lineWidth = 5;
    c.strokeStyle = kit.numberStroke;
    c.strokeText(kit.name.toUpperCase(), 128, 40, 236);
    c.fillStyle = kit.numberColor;
    c.fillText(kit.name.toUpperCase(), 128, 40, 236);
  }
  c.font = "170px 'Bebas Neue', Anton, Impact, sans-serif";
  c.lineWidth = 10;
  c.strokeStyle = kit.numberStroke;
  c.strokeText(kit.number || "", 128, 158);
  c.fillStyle = kit.numberColor;
  c.fillText(kit.number || "", 128, 158);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.6, side: THREE.DoubleSide }));
}


type V3 = { x: number; y: number; z: number };
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

/* ------------------------------------------------------------------ */
/* Peinture du maillot (carte UV « en croix » du modèle)              */
/* ------------------------------------------------------------------ */

export function paintKit(k: KitPaint): HTMLCanvasElement {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.fillStyle = k.base;
  c.fillRect(0, 0, S, S);
  // texture tissée discrète
  c.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = 0; y < S; y += 4) c.fillRect(0, y, S, 1);

  const flames = (x0: number, x1: number, yWaist: number, yTop: number) => {
    const dir = yTop < yWaist ? -1 : 1;
    const span = Math.abs(yTop - yWaist);
    const g = c.createLinearGradient(0, yWaist, 0, yWaist + dir * span);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.5, "rgba(255,255,255,0.8)");
    g.addColorStop(0.82, "rgba(255,255,255,0)");
    c.strokeStyle = g;
    c.lineCap = "round";
    const n = 12;
    const cx = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const bx = cx + u * half * 0.92;
      const tall = span * (0.9 - Math.abs(u) * 0.38);
      c.lineWidth = 15 - Math.abs(u) * 6;
      c.beginPath();
      c.moveTo(bx, yWaist);
      for (let s = 1; s <= 8; s++) {
        const yy = yWaist + (dir * tall * s) / 8;
        const xx = bx - u * (s / 8) * half * 0.35 + Math.sin(s * 1.6 + i * 2.1) * 10;
        c.lineTo(xx, yy);
      }
      c.stroke();
    }
  };
  if (k.flames) {
    flames(190, 512, 1020, 560); // devant : taille en bas
    flames(190, 512, 4, 470); // dos : taille en haut (carte inversée)
  }
  // short, chaussettes, chaussures
  c.fillStyle = k.shorts;
  c.fillRect(758, 10, 256, 740);
  c.fillStyle = k.socks;
  c.fillRect(760, 760, 264, 264);
  c.fillStyle = k.cuff;
  c.fillRect(760, 760, 264, 30);
  c.fillStyle = k.boots;
  c.fillRect(560, 10, 150, 250);
  // col et bords de manche
  c.strokeStyle = k.collar;
  c.lineWidth = 18;
  c.beginPath();
  c.ellipse(370, 507, 52, 34, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = k.cuff;
  c.fillRect(14, 330, 42, 360);
  c.fillRect(676, 330, 42, 360);
  if (k.sleeveless) {
    // débardeur : manches = peau, liseré rouge à l'emmanchure
    c.fillStyle = k.skin;
    c.fillRect(0, 300, 196, 420);
    c.fillRect(508, 300, 230, 420);
    c.fillStyle = k.collar;
    c.fillRect(186, 300, 14, 420);
    c.fillRect(500, 300, 14, 420);
  }
  // drapeau RDC (poitrine) + petit drapeau dans la nuque
  if (k.flag) {
    const fx = 262;
    const fy = 588;
    const fw = 54;
    const fh = 38;
    c.fillStyle = "#007fff";
    c.fillRect(fx, fy, fw, fh);
    c.strokeStyle = "#f7d618";
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(fx, fy + fh);
    c.lineTo(fx + fw, fy);
    c.stroke();
    c.strokeStyle = "#ce1021";
    c.lineWidth = 7;
    c.stroke();
    c.fillStyle = "#f7d618";
    c.beginPath();
    c.arc(fx + 10, fy + 9, 6, 0, Math.PI * 2);
    c.fill();
    // écusson
    c.fillStyle = "#facc15";
    c.beginPath();
    c.moveTo(430, 588);
    c.lineTo(466, 588);
    c.lineTo(466, 612);
    c.quadraticCurveTo(448, 634, 430, 612);
    c.closePath();
    c.fill();
    // nuque (dos, carte inversée)
    ["#007fff", "#f7d618", "#ce1021"].forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(358 + i * 9, 440, 9, 26);
    });
  }
  // nom + numéro dans le dos (carte retournée de 180°)
  if (k.number) {
    c.save();
    c.translate(351, 250);
    c.rotate(Math.PI);
    c.textAlign = "center";
    c.textBaseline = "middle";
    if (k.name) {
      c.font = "800 44px Sora, system-ui, sans-serif";
      c.lineWidth = 6;
      c.strokeStyle = k.numberStroke;
      c.strokeText(k.name.toUpperCase(), 0, -150, 300);
      c.fillStyle = k.numberColor;
      c.fillText(k.name.toUpperCase(), 0, -150, 300);
    }
    c.font = "220px 'Bebas Neue', Anton, Impact, sans-serif";
    c.lineWidth = 12;
    c.strokeStyle = k.numberStroke;
    c.strokeText(k.number, 0, 10);
    c.fillStyle = k.numberColor;
    c.fillText(k.number, 0, 10);
    c.restore();
    // petit numéro sur le short
    c.save();
    c.font = "90px 'Bebas Neue', Anton, Impact, sans-serif";
    c.fillStyle = k.numberColor;
    c.textAlign = "center";
    c.fillText(k.number, 860, 640);
    c.restore();
  }
  return cv;
}

/** Maillot peint sur la tenue de la joueuse (débardeur, short, chaussettes, chaussures). */
export function paintKitFemale(k: KitPaint): HTMLCanvasElement {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.fillStyle = k.base;
  c.fillRect(0, 0, S, S);
  c.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = 0; y < S; y += 4) c.fillRect(0, y, S, 1);
  const flames = (x0: number, x1: number, yWaist: number, yTop: number) => {
    const dir = yTop < yWaist ? -1 : 1;
    const span = Math.abs(yTop - yWaist);
    const g = c.createLinearGradient(0, yWaist, 0, yWaist + dir * span);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.5, "rgba(255,255,255,0.8)");
    g.addColorStop(0.82, "rgba(255,255,255,0)");
    c.strokeStyle = g;
    c.lineCap = "round";
    const n = 12;
    const cx = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const bx = cx + u * half * 0.92;
      const tall = span * (0.9 - Math.abs(u) * 0.38);
      c.lineWidth = 15 - Math.abs(u) * 6;
      c.beginPath();
      c.moveTo(bx, yWaist);
      for (let st = 1; st <= 8; st++) {
        c.lineTo(bx - u * (st / 8) * half * 0.35 + Math.sin(st * 1.6 + i * 2.1) * 10, yWaist + (dir * tall * st) / 8);
      }
      c.stroke();
    }
  };
  if (k.flames) {
    flames(330, 645, 985, 580);
    flames(330, 645, 55, 470);
  }
  // short, chaussettes, chaussures
  c.fillStyle = k.shorts;
  c.fillRect(750, 20, 170, 700);
  c.fillRect(10, 90, 240, 250);
  c.fillStyle = k.socks;
  c.fillRect(10, 510, 240, 490);
  c.fillStyle = k.cuff;
  c.fillRect(10, 510, 240, 26);
  c.fillStyle = k.boots;
  c.fillRect(790, 740, 234, 284);
  c.fillRect(930, 0, 94, 720);
  // col
  c.strokeStyle = k.collar;
  c.lineWidth = 16;
  c.beginPath();
  c.ellipse(462, 527, 62, 36, 0, 0, Math.PI * 2);
  c.stroke();
  if (k.flag) {
    const fx = 395;
    const fy = 615;
    c.fillStyle = "#007fff";
    c.fillRect(fx, fy, 50, 34);
    c.strokeStyle = "#f7d618";
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(fx, fy + 34);
    c.lineTo(fx + 50, fy);
    c.stroke();
    c.strokeStyle = "#ce1021";
    c.lineWidth = 6;
    c.stroke();
    c.fillStyle = "#facc15";
    c.beginPath();
    c.moveTo(520, 615);
    c.lineTo(552, 615);
    c.lineTo(552, 637);
    c.quadraticCurveTo(536, 656, 520, 637);
    c.closePath();
    c.fill();
  }
  if (k.number) {
    c.save();
    c.translate(487, 270);
    c.rotate(Math.PI);
    c.textAlign = "center";
    c.textBaseline = "middle";
    if (k.name) {
      c.font = "800 40px Sora, system-ui, sans-serif";
      c.lineWidth = 6;
      c.strokeStyle = k.numberStroke;
      c.strokeText(k.name.toUpperCase(), 0, -140, 280);
      c.fillStyle = k.numberColor;
      c.fillText(k.name.toUpperCase(), 0, -140, 280);
    }
    c.font = "200px 'Bebas Neue', Anton, Impact, sans-serif";
    c.lineWidth = 12;
    c.strokeStyle = k.numberStroke;
    c.strokeText(k.number, 0, 10);
    c.fillStyle = k.numberColor;
    c.fillText(k.number, 0, 10);
    c.restore();
  }
  return cv;
}

/* ------------------------------------------------------------------ */
/* Acteur                                                             */
/* ------------------------------------------------------------------ */

export interface RigMeta {
  kickContact: number;
  kickFoot: THREE.Vector3;
  dive: { te: number; hipLat: number; handLat: number; handY: number; dir: number };
}

export interface ProtoEntry {
  obj: THREE.Object3D;
  scale: number;
  rig: Rig;
  female: boolean;
  def: CharDef | null;
}

export class Actor {
  root = new THREE.Group();
  rig: Rig = "bip";
  female = false;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  bones: Record<string, THREE.Bone> = {};
  private actions = new Map<ClipName, THREE.AnimationAction>();
  current: ClipName | null = null;
  private rootRest = new THREE.Vector3();
  /** Annule le déplacement horizontal intégré à l'animation. */
  inPlace = false;
  /** Échelle du déplacement latéral / avant intégré (plongeons). */
  motionScale = { x: 1, y: 0, z: 1, lift: 0 };

  charId = "leopard";
  /** Facteur unité de l'os racine → mètres du modèle (Biped et Mixamo n'ont pas les mêmes unités). */
  private motionUnit = 1;

  constructor(public owner: Chars3D, entry: ProtoEntry, kit: KitPaint) {
    this.rig = entry.rig;
    this.charId = entry.def?.id || (entry.female ? "leoparde" : "leopard");
    this.female = entry.female;
    this.model = cloneSkinned(entry.obj);
    this.model.scale.setScalar(entry.scale);
    this.root.add(this.model);
    if (this.rig === "mx") {
      this.setupMixamo(entry, kit);
    } else this.model.traverse((o: any) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh && !o.userData.hair) {
        o.frustumCulled = false;
        o.castShadow = true;
        const female = !!o.userData.female;
        const tex = new THREE.CanvasTexture(female ? paintKitFemale(kit) : paintKit(kit));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        // joueuse : manches de t-shirt colorées par sommet (sauf débardeur de basket)
        const sl = female ? (o.geometry.attributes.sleeve as THREE.BufferAttribute | undefined) : undefined;
        if (sl) {
          o.geometry = o.geometry.clone();
          const cnt = sl.count;
          const col = new Float32Array(cnt * 3);
          const cs = new THREE.Color(kit.skin);
          const cj = new THREE.Color(kit.base);
          const cc = new THREE.Color(kit.cuff);
          const ch = new THREE.Color("#140c08");
          const hairA = o.geometry.attributes.hair as THREE.BufferAttribute | undefined;
          for (let i = 0; i < cnt; i++) {
            const f = kit.sleeveless ? 0 : sl.getX(i);
            const c = hairA && hairA.getX(i) > 0 ? ch : f === 2 ? cc : f === 1 ? cj : cs;
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
          }
          o.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
        }
        const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m: any, i: number) => {
          const name = String(m.name || "").toLowerCase();
          const isKit = female ? i === 0 : name.startsWith("kit");
          if (isKit) return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
          if (sl && (i === 1 || i === 2)) return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.58, metalness: 0, side: THREE.DoubleSide });
          return new THREE.MeshStandardMaterial({ color: new THREE.Color(kit.skin), roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
        });
        o.material = mats;
      } else if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    // alias canoniques (même code de jeu pour tous les squelettes)
    const real = RIG_BONES[this.rig];
    for (const k of Object.keys(BONE) as (keyof typeof BONE)[]) {
      const b = this.bones[real[k]];
      if (b) this.bones[BONE[k]] = b;
    }
    if (kit.gloves) {
      this.model.updateMatrixWorld(true);
      for (const hb of [BONE.lHand, BONE.rHand]) {
        const bone = this.bones[hb];
        if (!bone) continue;
        const ws = bone.getWorldScale(new THREE.Vector3()).x || 1;
        const mx = this.rig === "mx";
        const glove = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 12),
          new THREE.MeshStandardMaterial({ color: kit.gloves.main, roughness: 0.5 })
        );
        // os Mixamo orientés selon +y, os Biped selon +x
        if (mx) {
          glove.scale.set(0.06 / ws, 0.1 / ws, 0.045 / ws);
          glove.position.set(0, 0.07 / ws, 0);
        } else {
          glove.scale.set(7, 11.5, 4.6);
          glove.position.set(7, 0, 0);
        }
        bone.add(glove);
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), new THREE.MeshStandardMaterial({ color: kit.gloves.strap, roughness: 0.5 }));
        if (mx) {
          strap.scale.set(0.045 / ws, 0.035 / ws, 0.045 / ws);
          strap.position.set(0, 0.005 / ws, 0);
        } else {
          strap.scale.set(4.6, 3.4, 4.6);
          strap.rotation.z = Math.PI / 2;
          strap.position.set(0.5, 0, 0);
        }
        bone.add(strap);
      }
    }
    this.mixer = new THREE.AnimationMixer(this.model);
    const rb = this.bones[BONE.root];
    if (rb) {
      this.rootRest.copy(rb.position);
      this.model.updateMatrixWorld(true);
      this.motionUnit = rb.parent ? Math.abs(rb.parent.getWorldScale(new THREE.Vector3()).x) : entry.scale;
    }
  }

  /** Personnage Mixamo : vêtements aux couleurs de l'équipe, dossard, alias d'os. */
  private setupMixamo(entry: ProtoEntry, kit: KitPaint) {
    const def = entry.def;
    this.model.traverse((o: any) => {
      if (o.isBone) {
        o.name = mxName(o.name);
        this.bones[o.name] = o;
      }
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.castShadow = true;
      if (def?.ownOutfit || def?.noJersey) return;
      const nm = String(o.name || "");
      const cat = /shirt|hood|sweater|cloth|suit|collar|upperbody|scarf|jacket|top/i.test(nm)
        ? "top"
        : /pant|lowerbody|short|jean|trouser|skirt/i.test(nm)
          ? "bottom"
          : /shoe|sneaker|heel|boot/i.test(nm)
            ? "feet"
            : /sock/i.test(nm)
              ? "socks"
              : "";
      if (!cat) return;
      const color = cat === "top" ? kit.base : cat === "bottom" ? kit.shorts : cat === "socks" ? kit.socks : kit.boots;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m: any) => {
        const nmat = m.clone();
        const t = tintTexture(m.map, color, `${def?.id}:${nm}:`);
        if (t) {
          nmat.map = t;
          nmat.color = new THREE.Color(0xffffff);
        } else {
          nmat.map = null;
          nmat.color = new THREE.Color(color);
        }
        nmat.needsUpdate = true;
        return nmat;
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
    });
    // dossard dans le dos (uniquement pour les joueurs en maillot officiel)
    if (kit.number && !def?.ownOutfit && !def?.noJersey) {
      this.model.updateMatrixWorld(true);
      const sp = this.bones[RIG_BONES.mx.spine2] || this.bones[RIG_BONES.mx.spine];
      if (sp) {
        const plate = backPlate(kit);
        const wp = sp.getWorldPosition(new THREE.Vector3());
        const unit = 1;
        const target = wp.clone().add(new THREE.Vector3(0, 0.02 * unit, -0.15 * unit));
        plate.position.copy(sp.worldToLocal(target));
        const wq = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
        plate.quaternion.copy(wq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)));
        const ws = sp.getWorldScale(new THREE.Vector3());
        const size = entry.def?.cartoon ? 0.26 : 0.3;
        plate.scale.set(size / ws.x, size / ws.y, size / ws.z);
        sp.add(plate);
      }
    }
  }

  /** Fichier d'animation correspondant à un rôle pour ce personnage. */
  private resolve(role: ClipName): THREE.AnimationClip | null {
    if (this.rig === "bip") return this.owner.clips[(BIP_FALLBACK[role] || role) as keyof typeof FILES] || null;
    const r = MX_ROLE[role];
    const slug = r ? (this.female ? r.f : r.m) : role;
    const id = this.charId;
    if (this.owner.mxClips[slug]) return this.owner.mxClipFor(id, slug, this.rootRest.y);
    return this.owner.mxClips["catch-c"] ? this.owner.mxClipFor(id, "catch-c", this.rootRest.y) : null;
  }

  /** Durée d'une animation (rôle) pour ce personnage. */
  duration(role: ClipName) {
    return this.resolve(role)?.duration ?? 1;
  }

  has(role: ClipName) {
    return this.rig === "mx" ? !!MX_ROLE[role] && !!this.owner.mxClips[this.female ? MX_ROLE[role].f : MX_ROLE[role].m] : !!this.owner.clips[role as keyof typeof FILES];
  }

  action(name: ClipName) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.resolve(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    return a;
  }

  /** Fige l'animation à un instant précis (temps de l'animation en secondes). */
  pose(name: ClipName, time: number) {
    const a = this.action(name);
    if (!a) return;
    if (this.current !== name) {
      this.mixer.stopAllAction();
      a.reset();
      a.play();
      this.current = name;
    }
    a.paused = false;
    // micro-décalage alterné : force Three à réécrire tous les os (sinon les ajustements s'accumulent)
    this.jitter = !this.jitter;
    a.time = Math.max(0, Math.min(time + (this.jitter ? 0.0004 : 0), a.getClip().duration - 0.001));
    a.weight = 1;
    this.mixer.update(0);
    this.applyMotion(name);
  }
  private jitter = false;

  /** Mélange deux animations figées (transitions douces). */
  blend(a: ClipName, ta: number, b: ClipName, tb: number, w: number) {
    if (w <= 0.001) return this.pose(a, ta);
    if (w >= 0.999) return this.pose(b, tb);
    const A = this.action(a);
    const B = this.action(b);
    if (!A || !B) return;
    this.mixer.stopAllAction();
    this.jitter = !this.jitter;
    for (const [act, t, wt] of [[A, ta, 1 - w], [B, tb, w]] as const) {
      act.reset();
      act.play();
      act.time = Math.max(0, Math.min(t + (this.jitter ? 0.0004 : 0), act.getClip().duration - 0.001));
      act.weight = wt;
    }
    this.current = null;
    this.mixer.update(0);
    this.applyMotion(w < 0.5 ? a : b);
  }

  /** Déplacements intégrés à l'animation : appliqués comme décalage du modèle (jamais cumulés sur l'os). */
  private applyMotion(name: ClipName) {
    const rb = this.bones[BONE.root];
    const clip = this.resolve(name);
    const start = clip ? this.owner.rootStartOf(clip) : null;
    const sc = this.motionUnit;
    this.model.position.set(0, 0, 0);
    if (!rb || !start) return;
    const raw = rb.position;
    if (this.inPlace) {
      this.model.position.set((start.x - raw.x) * sc, 0, (start.z - raw.z) * sc);
      return;
    }
    const m = this.motionScale;
    this.model.position.set((raw.x - start.x) * (m.x - 1) * sc, (raw.y - start.y) * m.y * sc + m.lift, (raw.z - start.z) * (m.z - 1) * sc);
  }

  /** Place l'acteur (coordonnées du jeu) et l'oriente (0 = vers le but, π = vers la caméra). */
  place(x: number, z: number, yaw: number, mirror = false, y = 0) {
    this.root.position.set(-x, y, z);
    this.root.rotation.set(0, yaw, 0);
    this.root.scale.set(mirror ? -1 : 1, 1, 1);
  }

  /** Position monde d'un os, convertie en coordonnées du jeu. */
  bone(name: string, out: V3 = { x: 0, y: 0, z: 0 }): V3 {
    const b = this.bones[name];
    if (!b) return out;
    b.getWorldPosition(tmpV);
    out.x = -tmpV.x;
    out.y = tmpV.y;
    out.z = tmpV.z;
    return out;
  }

  /** Oriente un os (et ses enfants) pour que le segment os→enfant pointe dans une direction monde. */
  aim(boneName: string, childName: string, dirLocal: THREE.Vector3, weight = 1) {
    const b = this.bones[boneName];
    const ch = this.bones[childName];
    if (!b || !ch || !b.parent) return;
    this.root.updateMatrixWorld(true);
    const dir = dirLocal.clone().applyQuaternion(this.root.getWorldQuaternion(tmpQ2)).normalize();
    if (this.root.scale.x < 0) dir.x *= -1;
    b.getWorldPosition(tmpV);
    ch.getWorldPosition(tmpV2);
    const cur = tmpV2.sub(tmpV).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(cur, dir);
    const world = b.getWorldQuaternion(new THREE.Quaternion());
    const target = delta.multiply(world);
    const parentInv = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = parentInv.multiply(target);
    b.quaternion.slerp(local, weight);
    b.updateMatrixWorld(true);
  }

  /** Poing serré sur la tête, bras levés… : abaisse le bassin (genoux fléchis). */
  dropHips(m: number) {
    this.model.position.y -= m;
    this.model.updateMatrixWorld(true);
  }

  update(dt: number) {
    if (this.current) {
      this.mixer.update(dt);
      this.applyMotion(this.current);
    }
  }

}

/* ------------------------------------------------------------------ */
/* Scène                                                              */
/* ------------------------------------------------------------------ */

export class Chars3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  clips: Partial<Record<keyof typeof FILES, THREE.AnimationClip>> = {};
  /** Animations Mixamo (fichier → clip), noms d'os normalisés. */
  mxClips: Record<string, THREE.AnimationClip> = {};
  private rootStarts = new Map<THREE.AnimationClip, THREE.Vector3>();
  rootStartOf(clip: THREE.AnimationClip) {
    let v = this.rootStarts.get(clip);
    if (v === undefined) {
      const tr = clip.tracks.find((t) => /(^Bip001|mx_Hips)\.position$/.test(t.name));
      v = tr ? new THREE.Vector3(tr.values[0], tr.values[1], tr.values[2]) : new THREE.Vector3();
      this.rootStarts.set(clip, v);
    }
    return v;
  }
  private mxRetarget = new Map<string, THREE.AnimationClip>();
  /** Animation Mixamo adaptée à la taille du personnage (hauteur du bassin). */
  mxClipFor(charId: string, slug: string, hipsRestY: number) {
    const key = `${charId}:${slug}`;
    let c = this.mxRetarget.get(key);
    if (!c) {
      const src = this.mxClips[slug];
      c = src.clone();
      const tr = c.tracks.find((t) => t.name === "mx_Hips.position");
      if (tr && hipsRestY > 0) {
        const y0 = tr.values[1];
        const k = y0 > 0 ? hipsRestY / y0 : 1;
        if (Math.abs(k - 1) > 0.01) for (let i = 0; i < tr.values.length; i++) tr.values[i] *= k;
      }
      this.mxRetarget.set(key, c);
    }
    return c;
  }

  /** Personnages Mixamo chargés (id → prototype). */
  mxProtos = new Map<string, ProtoEntry>();
  private mxLoading = new Map<string, Promise<void>>();
  private mxClipsLoading: Promise<void> | null = null;
  /** Mesures par squelette : contact de frappe et plongeon. */
  metas: Partial<Record<Rig, RigMeta>> = {};
  proto: THREE.Object3D | null = null;
  scale = 0.01;
  ready = false;
  failed = false;
  actors: Actor[] = [];
  ball: THREE.Mesh;
  /** Instant du contact pied/ballon dans l'animation de frappe, et position du pied à cet instant (repère acteur). */
  kickContact = 0.83;
  kickFoot = new THREE.Vector3();

  constructor(public canvas: HTMLCanvasElement, ballKind: "foot" | "basket" = "foot") {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const hemi = new THREE.HemisphereLight(0xdbe7ff, 0x2a5a36, 1.15);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e0, 2.4);
    key.position.set(-7, 16, -6);
    key.castShadow = true;
    const mobile = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
    key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    const sc = key.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 18;
    sc.bottom = -18;
    sc.near = 1;
    sc.far = 70;
    key.target.position.set(0, 0, 8);
    this.scene.add(key.target);
    this.scene.add(key);
    this.key = key;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // sol invisible qui ne reçoit que les ombres (la pelouse reste dessinée en 2D)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.38 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.002, 8);
    ground.receiveShadow = true;
    this.scene.add(ground);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.4);
    rim.position.set(8, 9, 30);
    this.scene.add(rim);
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballKind === "foot" ? 0.11 : 0.12, 48, 32),
      new THREE.MeshStandardMaterial({ map: ballTexture(ballKind), roughness: ballKind === "foot" ? 0.32 : 0.7, metalness: 0 })
    );
    this.ball.castShadow = true;
    this.ball.visible = false;
    this.scene.add(this.ball);
  }

  async load(names: ClipName[]) {
    try {
      // les textures référencées par le FBX n'existent pas (maillots peints à la volée) : on les remplace par un pixel vide
      const manager = new THREE.LoadingManager();
      const EMPTY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      manager.setURLModifier((url) => (/\.(png|jpe?g|tga|psd|bmp|tiff?)$/i.test(url) ? EMPTY : url));
      const loader = new FBXLoader(manager);
      const proto = await loader.loadAsync(BASE + "player.fbx");
      const box = new THREE.Box3().setFromObject(proto);
      this.scale = 1.85 / box.getSize(new THREE.Vector3()).y;
      this.proto = proto;
      for (const n of names) {
        if (!(n in FILES)) continue;
        const key = n as keyof typeof FILES;
        const g = await loader.loadAsync(BASE + FILES[key]);
        const clip = g.animations[0];
        if (!clip) continue;
        clip.name = n;
        this.clips[key] = clip;
      }
      if (this.clips.kick) this.measureKick();
      if (this.clips.dive) this.measureDive();
      this.ready = true;
    } catch (e) {
      this.failed = true;
      console.warn("[arène] personnages 3D indisponibles", e);
    }
  }

  /* ---------------- Joueuse : transfert du squelette ---------------- */
  femProto: THREE.Object3D | null = null;
  femaleLoading: Promise<void> | null = null;
  onFemaleReady: (() => void) | null = null;

  /** Charge la joueuse et lui greffe le squelette du joueur (mêmes animations). */
  loadFemale() {
    if (this.femaleLoading || !this.proto) return this.femaleLoading;
    this.femaleLoading = (async () => {
      try {
        const manager = new THREE.LoadingManager();
        const EMPTY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        manager.setURLModifier((url) => (/\.(png|jpe?g|tga|psd|bmp|tiff?)$/i.test(url) ? EMPTY : url));
        const fem = await new FBXLoader(manager).loadAsync(BASE + "femme.fbx");
        this.femProto = await this.transferSkin(fem);
        this.onFemaleReady?.();
      } catch (e) {
        console.warn("[arène] joueuse 3D indisponible", e);
      }
    })();
    return this.femaleLoading;
  }

  /**
   * Transfert des poids de peau : chaque sommet de la joueuse reprend les os et poids
   * des sommets les plus proches du joueur (même pose de référence en A).
   */
  private async transferSkin(fem: THREE.Object3D): Promise<THREE.Object3D> {
    const out = cloneSkinned(this.proto!);
    out.updateMatrixWorld(true);
    fem.updateMatrixWorld(true);
    let male: THREE.SkinnedMesh | null = null;
    out.traverse((o: any) => {
      if (o.isSkinnedMesh && !male) male = o;
    });
    let ath: THREE.Mesh | null = null;
    fem.traverse((o: any) => {
      if (o.isMesh && !/ball/i.test(o.name) && (!ath || o.geometry.attributes.position.count > (ath as any).geometry.attributes.position.count)) ath = o;
    });
    if (!male || !ath) throw new Error("maillages introuvables");
    const M = male as THREE.SkinnedMesh;
    const F = ath as THREE.Mesh;
    const mg = M.geometry;
    const mPos = mg.attributes.position;
    const mSkI = mg.attributes.skinIndex;
    const mSkW = mg.attributes.skinWeight;
    // boîtes en coordonnées monde (pose de référence)
    const v = new THREE.Vector3();
    const mBox = new THREE.Box3();
    for (let i = 0; i < mPos.count; i++) mBox.expandByPoint(v.fromBufferAttribute(mPos, i).applyMatrix4(M.matrixWorld));
    const fg = F.geometry;
    const fPos = fg.attributes.position;
    const fBox = new THREE.Box3();
    for (let i = 0; i < fPos.count; i++) fBox.expandByPoint(v.fromBufferAttribute(fPos, i).applyMatrix4(F.matrixWorld));
    const mH = mBox.max.y - mBox.min.y;
    const k = (mH * 0.97) / (fBox.max.y - fBox.min.y);
    const mC = mBox.getCenter(new THREE.Vector3());
    const fC = fBox.getCenter(new THREE.Vector3());
    const align = new THREE.Matrix4()
      .makeTranslation(mC.x, mBox.min.y, mC.z)
      .multiply(new THREE.Matrix4().makeScale(k, k, k))
      .multiply(new THREE.Matrix4().makeTranslation(-fC.x, -fBox.min.y, -fC.z))
      .multiply(F.matrixWorld);
    const toMale = new THREE.Matrix4().copy(M.matrixWorld).invert().multiply(align);
    const nMat = new THREE.Matrix3().getNormalMatrix(toMale);
    // sommets du joueur en repère local du maillage
    const mx: number[] = [];
    for (let i = 0; i < mPos.count; i++) {
      v.fromBufferAttribute(mPos, i);
      mx.push(v.x, v.y, v.z);
    }
    // bornes en local pour la grille et l'entrejambe
    const lb = new THREE.Box3();
    for (let i = 0; i < mPos.count; i++) lb.expandByPoint(v.set(mx[i * 3], mx[i * 3 + 1], mx[i * 3 + 2]));
    const lsize = lb.getSize(new THREE.Vector3());
    const upAxis = lsize.y >= lsize.z ? 1 : 2;
    const cell = Math.max(lsize.x, lsize.y, lsize.z) / 70;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let i = 0; i < mPos.count; i++) {
      const kk = key(mx[i * 3], mx[i * 3 + 1], mx[i * 3 + 2]);
      let arr = grid.get(kk);
      if (!arr) grid.set(kk, (arr = []));
      arr.push(i);
    }
    const lc = lb.getCenter(new THREE.Vector3());
    const upMin = upAxis === 1 ? lb.min.y : lb.min.z;
    const upSpan = upAxis === 1 ? lsize.y : lsize.z;
    const crotch = upMin + upSpan * 0.47;
    // axe latéral = le plus large des deux axes horizontaux (bras en A)
    const latAxis = upAxis === 1 ? (lsize.x >= lsize.z ? 0 : 2) : lsize.x >= lsize.y ? 0 : 1;
    const latC = latAxis === 0 ? lc.x : latAxis === 1 ? lc.y : lc.z;
    // classe de chaque sommet du joueur selon son os dominant : 0 tronc/tête, 1 bras/épaules, 2 jambes
    const boneClass = M.skeleton.bones.map((b) => (/Thigh|Calf|Foot|Toe/.test(b.name) ? 2 : /UpperArm|Forearm|Hand|Finger|Clavicle|Shoulder/.test(b.name) ? 1 : 0));
    // doigts rattachés rigidement à la main (évite les mains déformées)
    const bonesArr = M.skeleton.bones;
    const handIdx = (side: string) => bonesArr.findIndex((b) => b.name === `Bip001_${side}_Hand`);
    const lHandI = handIdx("L");
    const rHandI = handIdx("R");
    const remap = bonesArr.map((b, i) => (/Finger/.test(b.name) ? (/_L_|\bL\b/.test(b.name) ? lHandI : rHandI) : i));
    const vClass = new Uint8Array(mPos.count);
    for (let i = 0; i < mPos.count; i++) {
      let bw = -1;
      let bi = 0;
      for (let c = 0; c < 4; c++) {
        const w = mSkW.getComponent(i, c);
        if (w > bw) {
          bw = w;
          bi = mSkI.getComponent(i, c);
        }
      }
      vClass[i] = boneClass[bi] ?? 0;
    }
    const n = fPos.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const skI = new Uint16Array(n * 4);
    const skW = new Float32Array(n * 4);
    const fNor = fg.attributes.normal;
    const search = new Float32Array(n * 3);
    const allowA = new Uint8Array(n);
    const sideA = new Int8Array(n);
    // recalage des bras : l'épaule→bout des doigts de la joueuse est projeté sur celui du joueur
    const comp = (w: THREE.Vector3, ax: number) => (ax === 0 ? w.x : ax === 1 ? w.y : w.z);
    const setComp = (w: THREE.Vector3, ax: number, val: number) => (ax === 0 ? (w.x = val) : ax === 1 ? (w.y = val) : (w.z = val));
    const boneLocal = (name: string) => {
      const bi = bonesArr.findIndex((b) => b.name === name);
      if (bi < 0) return null;
      return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(M.skeleton.boneInverses[bi]).invert()).applyMatrix4(M.bindMatrixInverse);
    };
    const fLocal: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) fLocal.push(new THREE.Vector3().fromBufferAttribute(fPos, i).applyMatrix4(toMale));
    const armMap = ([-1, 1] as const).map((sg) => {
      const cands = [boneLocal("Bip001_L_UpperArm"), boneLocal("Bip001_R_UpperArm")].filter(Boolean) as THREE.Vector3[];
      const S_m = cands.find((c) => Math.sign(comp(c, latAxis) - latC) === sg) || null;
      if (!S_m) return null;
      let T_m: THREE.Vector3 | null = null;
      for (let j = 0; j < mPos.count; j++) {
        const l = (mx[j * 3 + latAxis] - latC) * sg;
        if (l > 0 && (!T_m || l > (comp(T_m, latAxis) - latC) * sg)) T_m = new THREE.Vector3(mx[j * 3], mx[j * 3 + 1], mx[j * 3 + 2]);
      }
      let T_f: THREE.Vector3 | null = null;
      for (const w of fLocal) {
        const l = (comp(w, latAxis) - latC) * sg;
        if (l > 0 && (!T_f || l > (comp(T_f, latAxis) - latC) * sg)) T_f = w.clone();
      }
      if (!T_m || !T_f) return null;
      const S_f = S_m.clone();
      const upAx = upAxis;
      setComp(S_f, upAx, upMin + (comp(S_m, upAx) - upMin) * 0.97);
      setComp(S_f, latAxis, latC + (comp(S_m, latAxis) - latC) * 0.86);
      return { S_m, T_m, S_f, T_f, sg };
    });
    const mapArm = (w: THREE.Vector3, sideSign: number) => {
      const m = armMap.find((a) => a && a.sg === sideSign);
      if (!m) return w;
      const df = m.T_f.clone().sub(m.S_f);
      const dm = m.T_m.clone().sub(m.S_m);
      const rel = w.clone().sub(m.S_f);
      const lenSq = df.lengthSq();
      if (lenSq < 0.0001) return w;
      const t = Math.max(-0.08, Math.min(1.12, rel.dot(df) / lenSq));
      const proj = df.clone().multiplyScalar(t);
      const off = rel.clone().sub(proj).multiplyScalar(dm.length() / df.length());
      return m.S_m.clone().add(dm.clone().multiplyScalar(t)).add(off);
    };
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(fPos, i).applyMatrix4(toMale);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      if (fNor) {
        const nn = new THREE.Vector3().fromBufferAttribute(fNor, i).applyMatrix3(nMat).normalize();
        nor[i * 3] = nn.x;
        nor[i * 3 + 1] = nn.y;
        nor[i * 3 + 2] = nn.z;
      }
      const up = upAxis === 1 ? v.y : v.z;
      const latV = latAxis === 0 ? v.x : latAxis === 1 ? v.y : v.z;
      const side = latV - latC;
      const h01 = (up - upMin) / upSpan;
      // région de la joueuse : bras (écartés en A), jambes, tronc
      const region = h01 > 0.28 && h01 < 0.88 && Math.abs(side) > upSpan * 0.11 ? 1 : up < crotch ? 2 : 0;
      const allow = (cls: number) =>
        region === 1 ? cls === 1 : region === 2 ? cls === 2 || (cls === 0 && h01 > 0.42) : cls === 0 || (cls === 2 && h01 < 0.55);
      // point de recherche (bras recalés sur ceux du joueur), classes d'os autorisées, côté imposé
      const sv = region === 1 ? mapArm(v.clone(), Math.sign(side) || 1) : v;
      search[i * 3] = sv.x;
      search[i * 3 + 1] = sv.y;
      search[i * 3 + 2] = sv.z;
      let mask = 0;
      for (let cls = 0; cls < 3; cls++) if (allow(cls)) mask |= 1 << cls;
      allowA[i] = mask;
      sideA[i] = region !== 0 && Math.abs(side) > cell * 0.5 ? (Math.sign(side) as -1 | 1) : 0;
    }
    // plus proches voisins : dans un worker (l'écran reste réactif), sinon en direct
    const mSkIa = new Uint16Array(mPos.count * 4);
    const mSkWa = new Float32Array(mPos.count * 4);
    for (let j = 0; j < mPos.count; j++)
      for (let c = 0; c < 4; c++) {
        mSkIa[j * 4 + c] = mSkI.getComponent(j, c);
        mSkWa[j * 4 + c] = mSkW.getComponent(j, c);
      }
    const input: SkinInput = {
      n, search, allow: allowA, side: sideA, mx: Float32Array.from(mx), vClass, mSkI: mSkIa, mSkW: mSkWa,
      remap: Int16Array.from(remap), cell, latAxis, latC
    };
    const res = await runSkin(input);
    skI.set(res.skI);
    skW.set(res.skW);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (fNor) geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    if (fg.attributes.uv) geo.setAttribute("uv", fg.attributes.uv.clone());
    if (fg.index) geo.setIndex(fg.index.clone());
    for (const gr of fg.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(skI, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(skW, 4));
    if (!fNor) geo.computeVertexNormals();
    // manches de t-shirt : peau du haut du bras (jusqu'à mi-bras), avec un liseré
    {
      const bodyV = new Uint8Array(n);
      const idxA = fg.index;
      for (const gr of fg.groups) {
        if (gr.materialIndex !== 1) continue;
        for (let k2 = gr.start; k2 < gr.start + gr.count; k2++) bodyV[idxA ? idxA.getX(k2) : k2] = 1;
      }
      const bindPos = (name: string) => {
        const bi = bonesArr.findIndex((b) => b.name === name);
        if (bi < 0) return null;
        return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(M.skeleton.boneInverses[bi]).invert());
      };
      const arms = (["L", "R"] as const).map((sd) => ({
        up: bonesArr.findIndex((b) => b.name === `Bip001_${sd}_UpperArm`),
        a: bindPos(`Bip001_${sd}_UpperArm`),
        b: bindPos(`Bip001_${sd}_Forearm`)
      }));
      const sleeve = new Float32Array(n);
      const q = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        if (!bodyV[i]) continue;
        q.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(M.bindMatrix);
        for (const arm of arms) {
          if (!arm.a || !arm.b || arm.up < 0) continue;
          let wUp = 0;
          for (let c = 0; c < 4; c++) if (skI[i * 4 + c] === arm.up) wUp += skW[i * 4 + c];
          const ab = arm.b.clone().sub(arm.a);
          const t = q.clone().sub(arm.a).dot(ab) / ab.lengthSq();
          if (wUp > 0.25 && t < 0.52 && t > -0.30) sleeve[i] = t > 0.44 ? 2 : 1;
        }
      }
      // queue de cheval (fait partie du maillage de la tête) : derrière et sous le crâne → couleur cheveux
      const headV = new Uint8Array(n);
      for (const gr of fg.groups) {
        if (gr.materialIndex !== 2) continue;
        for (let k2 = gr.start; k2 < gr.start + gr.count; k2++) headV[idxA ? idxA.getX(k2) : k2] = 1;
      }
      out.updateMatrixWorld(true);
      const boneW = (name: string) => {
        let bw: THREE.Vector3 | null = null;
        out.traverse((o: any) => {
          if (o.isBone && o.name === name) bw = o.getWorldPosition(new THREE.Vector3());
        });
        return bw as THREE.Vector3 | null;
      };
      const neckW = boneW(RIG_BONES.bip.neck);
      const headW = boneW(RIG_BONES.bip.head);
      const hair = new Float32Array(n);
      if (neckW && headW) {
        const unitW = mH / 1.85;
        for (let i = 0; i < n; i++) {
          if (!headV[i]) continue;
          q.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(M.matrixWorld);
          const behind = q.z < neckW.z - 0.035 * unitW;
          const top = q.y > headW.y + 0.13 * unitW;
          if (behind || top) hair[i] = 1;
        }
      }
      geo.setAttribute("sleeve", new THREE.BufferAttribute(sleeve, 1));
      geo.setAttribute("hair", new THREE.BufferAttribute(hair, 1));
    }
    const mats = (Array.isArray(F.material) ? F.material : [F.material]).map(() => new THREE.MeshStandardMaterial());
    const sm = new THREE.SkinnedMesh(geo, mats);
    sm.name = "Joueuse";
    sm.userData.female = true;
    sm.position.copy(M.position);
    sm.quaternion.copy(M.quaternion);
    sm.scale.copy(M.scale);
    M.parent!.add(sm);
    sm.bind(M.skeleton, M.bindMatrix);
    M.parent!.remove(M);
    // coiffure : calotte + chignon, accrochés à l'os de la tête
    out.updateMatrixWorld(true);
    let head: THREE.Bone | null = null;
    out.traverse((o: any) => {
      if (o.isBone && o.name === RIG_BONES.bip.head) head = o;
    });
    if (head) {
      const H = head as THREE.Bone;
      const hp = H.getWorldPosition(new THREE.Vector3());
      const unit = mH / 1.85;
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 0.75 });
      const addHair = (geom: THREE.BufferGeometry, worldPos: THREE.Vector3, sc: THREE.Vector3) => {
        const m = new THREE.Mesh(geom, hairMat);
        m.userData.hair = true;
        const local = H.worldToLocal(worldPos.clone());
        m.position.copy(local);
        const wq = H.getWorldQuaternion(new THREE.Quaternion()).invert();
        m.quaternion.copy(wq);
        const ws = H.getWorldScale(new THREE.Vector3());
        m.scale.set(sc.x / ws.x, sc.y / ws.y, sc.z / ws.z);
        H.add(m);
      };
      // la tête est au-dessus de l'os : centre du crâne à ~10 cm
      const skull = hp.clone().add(new THREE.Vector3(0, 0.1 * unit, -0.01 * unit));
      addHair(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), skull, new THREE.Vector3(0.108 * unit, 0.118 * unit, 0.118 * unit));
      addHair(new THREE.SphereGeometry(1, 16, 12), skull.clone().add(new THREE.Vector3(0, 0.07 * unit, -0.11 * unit)), new THREE.Vector3(0.06 * unit, 0.06 * unit, 0.06 * unit));
    }
    return out;
  }

  /** Mesures du squelette classique (compatibilité). */
  private measureKick() {
    const a = this.actor(LEOPARDS_PAINT("", 10, "#6b4128"));
    const m = this.metas.bip || { kickContact: 0.83, kickFoot: new THREE.Vector3(), dive: { ...this.diveMeta } };
    this.measureKickOn(a, m);
    this.metas.bip = m;
    this.kickContact = m.kickContact;
    this.kickFoot.copy(m.kickFoot);
    this.remove(a);
  }

  /** Trouve l'instant du contact (pied le plus rapide vers l'avant, près du sol). */
  private measureKickOn(a: Actor, m: RigMeta) {
    if (!a.has("kick")) return;
    let best = 0;
    let bestT = 0.83;
    let bestFoot: string = BONE.rFoot;
    const prev: Record<string, V3 | null> = { [BONE.rFoot]: null, [BONE.lFoot]: null };
    const steps = 90;
    const dur = a.duration("kick");
    for (let i = 0; i <= steps; i++) {
      const t = (dur * i) / steps;
      a.pose("kick", t);
      a.root.updateMatrixWorld(true);
      for (const fb of [BONE.rFoot, BONE.lFoot]) {
        const f = a.bone(fb);
        const p = prev[fb];
        if (p && t > dur * 0.3 && t < dur * 0.85 && f.y < 0.35) {
          const v = (f.z - p.z) / (dur / steps);
          if (v > best) {
            best = v;
            bestT = t;
            bestFoot = fb;
          }
        }
        prev[fb] = { ...f };
      }
    }
    m.kickContact = bestT;
    a.pose("kick", bestT);
    a.root.updateMatrixWorld(true);
    const f = a.bone(bestFoot);
    m.kickFoot.set(f.x, f.y, f.z);
  }

  /** Mesure du plongeon : instant d'extension maximale, décalages mains/bassin et sens natif. */
  private measureDiveOn(a: Actor, m: RigMeta) {
    if (!a.has("dive")) return;
    const dur = a.duration("dive");
    let best = 0;
    // instant d'extension maximale en l'air (mains encore hautes), pas l'arrivée au sol
    const mx = a.rig === "mx";
    const t0 = mx ? dur * 0.1 : 0.35;
    const t1 = mx ? dur * 0.6 : 1.45;
    const minY = mx ? 0.6 : 0.45;
    for (let i = 0; i <= 60; i++) {
      const t = t0 + (i / 60) * (t1 - t0);
      a.pose("dive", t);
      a.root.updateMatrixWorld(true);
      const l = a.bone(BONE.lHand);
      const r = a.bone(BONE.rHand);
      const hand = Math.abs(l.x) > Math.abs(r.x) ? l : r;
      if (Math.abs(hand.x) > best && hand.y > minY) {
        best = Math.abs(hand.x);
        const hip = a.bone(BONE.pelvis);
        m.dive = { te: t, hipLat: Math.abs(hip.x), handLat: Math.abs(hand.x), handY: (l.y + r.y) / 2, dir: Math.sign(hand.x) || -1 };
      }
    }
  }

  /* ---------------- Personnages Mixamo ---------------- */

  /** Tous les personnages demandés sont-ils prêts ? (sans attente) */
  isLoaded(ids: (string | undefined | null)[]) {
    return ids.every((id) => {
      const d = charById(id);
      if (!d) return true;
      if (d.rig === "bip") return d.female ? !!this.femProto : !!this.proto;
      return this.mxProtos.has(d.id) && !!this.mxClips["kick"];
    });
  }

  /** Charge les personnages (GLB) et les animations Mixamo nécessaires. */
  async ensureChars(ids: (string | undefined | null)[]) {
    const jobs: Promise<unknown>[] = [];
    for (const id of new Set(ids)) {
      const d = charById(id);
      if (!d) continue;
      if (d.rig === "bip") {
        if (d.female) jobs.push(this.loadFemale() || Promise.resolve());
        continue;
      }
      if (!this.mxLoading.has(d.id)) this.mxLoading.set(d.id, this.loadMxChar(d));
      jobs.push(this.mxLoading.get(d.id)!);
      jobs.push(this.loadMxClips());
    }
    await Promise.all(jobs);
  }

  private async loadMxChar(d: CharDef) {
    try {
      const gltf = await new GLTFLoader().loadAsync(BASE + d.file);
      const obj = gltf.scene;
      obj.traverse((o: any) => {
        if (o.isBone) o.name = mxName(o.name);
      });
      const box = new THREE.Box3().setFromObject(obj);
      const h = box.getSize(new THREE.Vector3()).y || 1;
      const target = d.cartoon ? 1.55 : d.female ? 1.72 : 1.84;
      this.mxProtos.set(d.id, { obj, scale: target / h, rig: "mx", female: d.female, def: d });
    } catch (e) {
      // on pourra réessayer au prochain appel
      this.mxLoading.delete(d.id);
      console.warn("[arène] personnage indisponible", d.id, e);
    }
  }

  private loadMxClips() {
    if (this.mxClipsLoading) return this.mxClipsLoading;
    this.mxClipsLoading = (async () => {
      const loader = new FBXLoader();
      await Promise.all(
        MX_FILES.map(async (f) => {
          try {
            const g = await loader.loadAsync(`${BASE}mx/${f}.fbx`);
            const clip = g.animations[0];
            if (!clip) return;
            clip.name = f;
            // on garde les rotations + le déplacement du bassin : les longueurs d'os restent celles du personnage
            clip.tracks = clip.tracks.filter((t) => {
              t.name = mxName(t.name);
              return t.name.endsWith(".quaternion") || t.name === "mx_Hips.position";
            });
            this.mxClips[f] = clip;
          } catch {
            /* animation manquante : le rôle retombe sur une pose de base */
          }
        })
      );
      // animation de base manquante (réseau) : nouvel essai possible plus tard
      if (!this.mxClips["kick"]) this.mxClipsLoading = null;
    })();
    return this.mxClipsLoading;
  }

  /** Entrée de prototype pour un personnage (repli sur le joueur classique). */
  entryFor(charId?: string | null, female = false): ProtoEntry {
    const d = charById(charId);
    if (d && d.rig === "mx" && this.mxProtos.has(d.id) && this.mxClips["kick"]) return this.mxProtos.get(d.id)!;
    const fem = d ? d.female : female;
    // repli (personnage pas encore chargé) : le joueur classique, sous sa propre identité
    if (fem && this.femProto) return { obj: this.femProto, scale: this.scale, rig: "bip", female: true, def: charById("leoparde") };
    return { obj: this.proto!, scale: this.scale, rig: "bip", female: false, def: charById("leopard") };
  }

  /** Mesures (contact de frappe, plongeon) du squelette d'un acteur, calculées une seule fois. */
  metaFor(a: Actor): RigMeta {
    if (a.rig === "bip" && !a.female && this.metas.bip) return this.metas.bip;
    const key = `${a.rig}:${a.charId}`;
    let m = this.charMetas.get(key);
    if (!m) {
      const probe = new Actor(this, this.entryFor(a.charId, a.female), { ...LEOPARDS_PAINT("", 1, "#6b4128"), number: undefined });
      this.scene.add(probe.root);
      m = { kickContact: 0.83, kickFoot: new THREE.Vector3(), dive: { te: 1.15, hipLat: 2.3, handLat: 2.9, handY: 1.2, dir: -1 } };
      this.measureKickOn(probe, m);
      this.measureDiveOn(probe, m);
      this.scene.remove(probe.root);
      probe.mixer.stopAllAction();
      this.charMetas.set(key, m);
    }
    return m;
  }
  private charMetas = new Map<string, RigMeta>();

  actor(kit: KitPaint, charId?: string | null) {
    const entry = this.entryFor(charId, !!kit.female);
    const a = new Actor(this, entry, kit);
    this.scene.add(a.root);
    this.actors.push(a);
    return a;
  }

  remove(a: Actor) {
    this.scene.remove(a.root);
    this.actors = this.actors.filter((x) => x !== a);
    a.mixer.stopAllAction();
    a.root.traverse((o: any) => {
      if (o.isMesh) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => {
          m.map?.dispose();
          m.dispose();
        });
      }
    });
  }

  clearActors() {
    for (const a of [...this.actors]) this.remove(a);
  }

  resize(w: number, h: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
  }

  /** Recopie la caméra du jeu (focale, horizon, centre, zoom) dans Three. */
  sync(cam: Camera, w: number, h: number, view: GameView) {
    const c = this.camera;
    c.position.set(-cam.x, cam.y, cam.z);
    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    c.up.set(0, 1, 0);
    c.lookAt(-cam.x - fx, cam.y, cam.z + fz);
    c.aspect = w / h;
    c.near = 0.1;
    c.far = 400;
    c.updateProjectionMatrix();
    const f = cam.f * view.zoom;
    const cx = view.gx + (cam.cx - view.gx) * view.zoom + view.ox;
    const hz = view.gy + (cam.hz - view.gy) * view.zoom + view.oy;
    const e = c.projectionMatrix.elements;
    e[0] = (2 * f) / w;
    e[5] = (2 * f) / h;
    e[8] = 1 - (2 * cx) / w;
    e[9] = (2 * hz) / h - 1;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }

  /**
   * Ballon : position + rotation physique. La rotation suit le vecteur d'effet (ω)
   * et, au sol, le roulement. Coordonnées du jeu (x converti en -x).
   */
  setBall(x: number, y: number, z: number, omega?: { x: number; y: number; z: number }, vel?: { x: number; y: number; z: number }, dt = 0, visible = true) {
    this.ball.visible = visible;
    this.ball.position.set(-x, y, z);
    if (!dt) return;
    const r = 0.11;
    if (omega) {
      const w = new THREE.Vector3(-omega.x, omega.y, omega.z);
      const a = w.length();
      if (a > 0.01) this.ball.rotateOnWorldAxis(w.normalize(), a * dt);
    }
    if (vel) {
      // roulement au sol (et rotation « naturelle » de frappe en l'air)
      const v = new THREE.Vector3(-vel.x, 0, vel.z);
      const sp = v.length();
      if (sp > 0.05) {
        const axis = new THREE.Vector3(0, 1, 0).cross(v).normalize();
        const k = y < r + 0.03 ? 1 : 0.35;
        this.ball.rotateOnWorldAxis(axis, (sp / r) * dt * k);
      }
    }
  }

  setShadowCenter(x: number, z: number) {
    this.key.target.position.set(-x, 0, z);
    this.key.position.set(-x - 7, 16, z - 14);
  }

  /* ---------------- Panier de basket 3D ---------------- */
  private hoop: THREE.Group | null = null;
  private hoopNet: THREE.Mesh | null = null;

  buildHoop(boardZ: number, logo?: HTMLImageElement | null) {
    if (this.hoop) this.scene.remove(this.hoop);
    const g = new THREE.Group();
    const RIM_Y = 3.05;
    // planche en verre + cadre blanc + carré rouge
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.05, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 })
    );
    glass.position.set(0, 3.425, boardZ + 0.015);
    glass.castShadow = true;
    g.add(glass);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd81e27, roughness: 0.5 });
    const bar = (w: number, h: number, x: number, y: number, mat: THREE.Material, z = boardZ - 0.002) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), mat);
      m.position.set(-x, y, z);
      g.add(m);
    };
    bar(1.8, 0.05, 0, 3.925, frameMat);
    bar(1.8, 0.05, 0, 2.925, frameMat);
    bar(0.05, 1.05, -0.875, 3.425, frameMat);
    bar(0.05, 1.05, 0.875, 3.425, frameMat);
    bar(0.59, 0.04, 0, 3.5, redMat);
    bar(0.59, 0.04, 0, 3.07, redMat);
    bar(0.04, 0.45, -0.275, 3.285, redMat);
    bar(0.04, 0.45, 0.275, 3.285, redMat);
    if (logo) {
      const tex = new THREE.Texture(logo);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const ratio = logo.naturalWidth / logo.naturalHeight;
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.3 * ratio, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      lg.position.set(0, 3.73, boardZ - 0.01);
      lg.rotation.y = Math.PI;
      g.add(lg);
    }
    // cercle orange + support
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.6 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.011, 10, 48), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, RIM_Y, 0);
    rim.castShadow = true;
    g.add(rim);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, boardZ - 0.2), rimMat);
    brace.position.set(0, RIM_Y - 0.01, 0.2 + (boardZ - 0.2) / 2);
    g.add(brace);
    // filet (lathe) à mailles
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      pts.push(new THREE.Vector2(0.225 * (1 - 0.42 * k) + Math.sin(k * Math.PI) * 0.01, -0.44 * k));
    }
    const netTex = netTexture();
    netTex.repeat.set(6, 2);
    const net = new THREE.Mesh(
      new THREE.LatheGeometry(pts.reverse(), 24),
      new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false })
    );
    net.position.set(0, RIM_Y, 0);
    g.add(net);
    this.hoopNet = net;
    this.hoop = g;
    this.scene.add(g);
  }

  /** Le filet s'étire quand le ballon passe dedans. */
  updateHoop(pulse: number, t: number) {
    if (!this.hoopNet) return;
    const k = Math.max(0, pulse);
    this.hoopNet.scale.set(1 + k * 0.12 * Math.sin(t * 30), 1 + k * 0.35, 1 + k * 0.12 * Math.cos(t * 30));
  }

  /* ---------------- Cage et filet 3D ---------------- */
  private goal: THREE.Group | null = null;
  private net: { geo: THREE.BufferGeometry; rest: Float32Array; cols: number; rows: number } | null = null;
  key!: THREE.DirectionalLight;

  buildGoal(D: number) {
    if (this.goal) {
      this.scene.remove(this.goal);
      this.goal.traverse((o: any) => {
        o.geometry?.dispose?.();
        o.material?.map?.dispose?.();
        o.material?.dispose?.();
      });
    }
    const W = 3.66;
    const H = 2.44;
    const R = 0.06;
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const cyl = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true;
      g.add(m);
    };
    const P = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z);
    const backAt = (y: number) => D + 2 - y * 0.42;
    // poteaux + transversale (section ronde, angles arrondis)
    cyl(P(-W, 0, D), P(-W, H, D), R, white);
    cyl(P(W, 0, D), P(W, H, D), R, white);
    cyl(P(-W - R, H, D), P(W + R, H, D), R, white);
    for (const sx of [-W, W]) {
      const corner = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12), white);
      corner.position.copy(P(sx, H, D));
      g.add(corner);
    }
    // armature arrière
    for (const sx of [-W, W]) {
      cyl(P(sx, H, D), P(sx, H, backAt(H)), 0.022, dark);
      cyl(P(sx, H, backAt(H)), P(sx, 0, backAt(0)), 0.022, dark);
    }
    cyl(P(-W, 0, backAt(0)), P(W, 0, backAt(0)), 0.022, dark);
    cyl(P(-W, H, backAt(H)), P(W, H, backAt(H)), 0.018, dark);

    // filet : texture à mailles hexagonales, semi-transparente
    const tex = netTexture();
    const netMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false });
    const MESH = 0.14;
    const sheet = (cols: number, rows: number, fn: (u: number, v: number) => THREE.Vector3, uvScale: [number, number]) => {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const p = fn(i / cols, j / rows);
          pos.push(p.x, p.y, p.z);
          uv.push((i / cols) * uvScale[0], (j / rows) * uvScale[1]);
        }
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = j * (cols + 1) + i;
          idx.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, netMat);
      m.renderOrder = 2;
      g.add(m);
      return geo;
    };
    const cols = 44;
    const rows = 16;
    const backGeo = sheet(cols, rows, (u, v) => P(-W + 2 * W * u, H * v, backAt(H * v)), [(2 * W) / MESH, H / MESH]);
    sheet(24, 8, (u, v) => P(-W + 2 * W * u, H, D + (backAt(H) - D) * v), [(2 * W) / MESH, 1 / MESH]);
    for (const sx of [-W, W]) sheet(10, 16, (u, v) => P(sx, H * v, D + (backAt(H * v) - D) * u), [2 / MESH, H / MESH]);
    this.net = { geo: backGeo, rest: Float32Array.from(backGeo.attributes.position.array as ArrayLike<number>), cols, rows };
    this.goal = g;
    this.scene.add(g);
  }

  /** Le ballon pousse le filet du fond (déformation locale + petite onde). */
  updateNet(bx: number, by: number, bz: number, active: boolean, t: number) {
    const n = this.net;
    if (!n) return;
    const pos = n.geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let moved = false;
    for (let i = 0; i < arr.length; i += 3) {
      const rx = n.rest[i];
      const ry = n.rest[i + 1];
      const rz = n.rest[i + 2];
      let z = rz;
      if (active) {
        const d = Math.hypot(-rx - bx, ry - by);
        if (d < 1.1) {
          const push = Math.max(0, bz + 0.11 - rz) * Math.pow(1 - d / 1.1, 1.6);
          z = rz + push + Math.sin(d * 9 - t * 14) * 0.015 * (1 - d / 1.1);
        }
      }
      if (arr[i + 2] !== z) {
        arr[i + 2] = arr[i + 2] + (z - arr[i + 2]) * 0.6;
        moved = true;
      }
    }
    if (moved) {
      pos.needsUpdate = true;
      n.geo.computeVertexNormals();
    }
  }

  diveMeta: RigMeta["dive"] = { te: 1.15, hipLat: 2.3, handLat: 2.9, handY: 1.2, dir: -1 };
  private measureDive() {
    const a = this.actor(LEOPARDS_PAINT("", 1, "#6b4128"));
    const m = this.metas.bip || { kickContact: this.kickContact, kickFoot: this.kickFoot.clone(), dive: { ...this.diveMeta } };
    this.measureDiveOn(a, m);
    this.metas.bip = m;
    this.diveMeta = m.dive;
    this.remove(a);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.clearActors();
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------ */

export const LEOPARDS_PAINT = (name: string, number: number | string | undefined | null, skin: string, boots = "#1e3a8a"): KitPaint => ({
  base: "#2fa2e3",
  flames: true,
  collar: "#e0263a",
  cuff: "#e0263a",
  shorts: "#2fa2e3",
  socks: "#2fa2e3",
  boots,
  name,
  number: number !== undefined && number !== null && String(number).trim() !== "" ? String(number) : undefined,
  numberColor: "#e0263a",
  numberStroke: "#ffffff",
  flag: true,
  skin
});

export const KEEPER_PAINT = (k: { jersey: string; jersey2: string; trim: string; shorts: string; socks: string; gloves: string; gloves2: string }, skin: string): KitPaint => ({
  base: k.jersey,
  collar: k.trim,
  cuff: k.jersey2,
  shorts: k.shorts,
  socks: k.socks,
  boots: "#111827",
  number: "1",
  numberColor: k.trim,
  numberStroke: k.jersey2,
  skin,
  gloves: { main: k.gloves, strap: k.gloves2 }
});

export const RIVAL_PAINT = (number: number, skin: string): KitPaint => ({
  base: "#f8fafc",
  collar: "#16a34a",
  cuff: "#16a34a",
  shorts: "#f8fafc",
  socks: "#16a34a",
  boots: "#111827",
  number: String(number),
  numberColor: "#16a34a",
  numberStroke: "#f8fafc",
  skin
});

/** Texture équirectangulaire d'un vrai ballon : 12 pentagones noirs, 20 hexagones blancs, coutures. */
function ballTexture(kind: "foot" | "basket") {
  const W = 1024;
  const H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  const img = c.createImageData(W, H);
  const d = img.data;
  if (kind === "foot") {
    const phi = (1 + Math.sqrt(5)) / 2;
    const ico: number[][] = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi],
      [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map((v) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });
    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    const hex = faces.map((f) => {
      const v = [0, 1, 2].map((k) => ico[f[0]][k] + ico[f[1]][k] + ico[f[2]][k]);
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });
    const centers = [...ico.map((v) => ({ v, pent: true })), ...hex.map((v) => ({ v, pent: false }))];
    for (let y = 0; y < H; y++) {
      const lat = Math.PI * (0.5 - y / H);
      const cl = Math.cos(lat);
      const sl = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const p = [cl * Math.cos(lon), sl, cl * Math.sin(lon)];
        let b1 = -2;
        let b2 = -2;
        let pent = false;
        for (const ctr of centers) {
          // les pentagones sont plus petits : on pénalise légèrement leur proximité
          const dot = p[0] * ctr.v[0] + p[1] * ctr.v[1] + p[2] * ctr.v[2] - (ctr.pent ? 0.012 : 0);
          if (dot > b1) {
            b2 = b1;
            b1 = dot;
            pent = ctr.pent;
          } else if (dot > b2) b2 = dot;
        }
        const seam = b1 - b2 < 0.012;
        const i = (y * W + x) * 4;
        let col = pent ? [22, 24, 32] : [246, 247, 250];
        if (!pent) {
          // léger dégradé de cuir
          const n = 236 + ((x * 7 + y * 13) % 11);
          col = [n, n, n + 4];
        }
        if (seam) col = [150, 156, 168];
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // fines touches de couleur (bleu Congo) sur les hexagones, comme un ballon officiel
    c.globalAlpha = 0.18;
    c.fillStyle = "#1466E0";
    c.fillRect(0, H * 0.48, W, H * 0.04);
    c.globalAlpha = 1;
  } else {
    c.fillStyle = "#e2580b";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "#2b1203";
    c.lineWidth = 8;
    for (const x of [0, W / 4, W / 2, (3 * W) / 4]) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, H);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, H / 2);
    c.lineTo(W, H / 2);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Mailles hexagonales du filet (fond transparent). */
function netTexture() {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, S, S);
  c.strokeStyle = "rgba(248,250,252,1)";
  c.lineWidth = 7;
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(0, S * 0.25);
  c.lineTo(S * 0.5, 0);
  c.lineTo(S, S * 0.25);
  c.moveTo(0, S * 0.25);
  c.lineTo(0, S * 0.75);
  c.lineTo(S * 0.5, S);
  c.lineTo(S, S * 0.75);
  c.lineTo(S, S * 0.25);
  c.moveTo(S * 0.5, 0);
  c.lineTo(S * 0.5, -S * 0.25);
  c.moveTo(S * 0.5, S);
  c.lineTo(S * 0.5, S * 1.25);
  c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export { tmpQ, THREE };
