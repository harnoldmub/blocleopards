/**
 * Personnages dessinés à la main : squelette articulé 2D (vu de face ou de dos),
 * poses interpolées, tenues complètes (maillot, short, chaussettes, crampons, gants).
 * Coordonnées locales en mètres, y vers le haut ; 0 rad = membre vers le bas.
 */

export interface Kit {
  jersey: string;
  jersey2: string;
  trim: string;
  shorts: string;
  socks: string;
  boots: string;
  gloves?: string;
  gloves2?: string;
  longSleeves?: boolean;
  /** Écharpe diagonale (maillot des Léopards). */
  sash?: { color: string; edge: string };
  number?: string;
  name?: string;
  /** Débardeur de basket (épaules nues). */
  tank?: boolean;
  /** Motif du tissu (vagues blanches du maillot ciel des Léopards). */
  pattern?: "waves" | "flames";
  /** Col et bords de manche / emmanchures. */
  collar?: string;
  cuff?: string;
  /** Drapeau RDC sur la poitrine (face) et dans la nuque (dos). */
  flag?: boolean;
  /** Contour du numéro. */
  numberStroke?: string;
}

export interface Body {
  skin: string;
  hair: string;
  hairStyle: "short" | "fade" | "locks" | "bald" | "bun";
  height: number;
  bulk: number;
  headband?: string;
}

export interface Pose {
  roll: number;
  px: number;
  air: number;
  spine: number;
  lean: number;
  head: number;
  shL: number;
  elL: number;
  shR: number;
  elR: number;
  hipL: number;
  knL: number;
  hipR: number;
  knR: number;
  /** Raccourci de perspective des jambes (1 = longueur pleine). */
  fsL: number;
  fsR: number;
  /** Poignets (orientation des mains / gants). */
  wrL: number;
  wrR: number;
  /** Raccourcis par segment (bras, avant-bras, cuisse, tibia) : profondeur vue de dos/face. */
  kUaL: number; kFaL: number; kUaR: number; kFaR: number;
  kThL: number; kSnL: number; kThR: number; kSnR: number;
}

export const BASE_POSE: Pose = {
  roll: 0, px: 0, air: 0, spine: 0, lean: 0, head: 0,
  shL: -0.18, elL: -0.12, shR: 0.18, elR: 0.12,
  hipL: -0.06, knL: 0.02, hipR: 0.06, knR: -0.02,
  fsL: 1, fsR: 1, wrL: 0, wrR: 0,
  kUaL: 1, kFaL: 1, kUaR: 1, kFaR: 1, kThL: 1, kSnL: 1, kThR: 1, kSnR: 1
};

export const pose = (p: Partial<Pose>): Pose => ({ ...BASE_POSE, ...p });

const KEYS = Object.keys(BASE_POSE) as (keyof Pose)[];

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o = {} as Pose;
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    roll: -p.roll, px: -p.px, spine: -p.spine, head: -p.head,
    shL: -p.shR, elL: -p.elR, shR: -p.shL, elR: -p.elL,
    hipL: -p.hipR, knL: -p.knR, hipR: -p.hipL, knR: -p.knL,
    fsL: p.fsR, fsR: p.fsL, wrL: -p.wrR, wrR: -p.wrL,
    kUaL: p.kUaR, kFaL: p.kFaR, kUaR: p.kUaL, kFaR: p.kFaL,
    kThL: p.kThR, kSnL: p.kSnR, kThR: p.kThL, kSnR: p.kSnL
  };
}

/* ---------------- Squelette ---------------- */

export interface V { x: number; y: number }
export interface Skeleton {
  pelvis: V; neck: V; head: V; headR: number;
  shL: V; shR: V; elL: V; elR: V; haL: V; haR: V;
  hipL: V; hipR: V; knL: V; knR: V; anL: V; anR: V;
  spineA: number; wrL: number; wrR: number; armAL: number; armAR: number; foreAL: number; foreAR: number;
  shinAL: number; shinAR: number; thighAL: number; thighAR: number;
  scale: number;
}

const dir = (a: number): V => ({ x: Math.sin(a), y: -Math.cos(a) });
const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, y: a.y + b.y * k });

export function skeleton(p: Pose, body: Body): Skeleton {
  const h = body.height / 1.85;
  const SP = 0.54 * h * (1 - p.lean * 0.22);
  const NECK = 0.085 * h;
  const HR = 0.118 * h;
  const SW = 0.205 * h * (0.95 + body.bulk * 0.1);
  const HW = 0.1 * h;
  const UA = 0.3 * h;
  const FA = 0.27 * h;
  const TH = 0.46 * h;
  const SH = 0.46 * h;

  const P: V = { x: 0, y: 0 };
  const spineA = p.roll + p.spine + Math.PI;
  const neck = add(P, dir(spineA), SP);
  const head = add(neck, dir(spineA + p.head), NECK + HR);
  const perp = dir(spineA + Math.PI / 2);
  const shBase = add(neck, dir(spineA), -0.045 * h);
  const shL = add(shBase, perp, SW);
  const shR = add(shBase, perp, -SW);
  const hp = dir(p.roll + Math.PI + Math.PI / 2);
  const hipL = add(P, hp, HW);
  const hipR = add(P, hp, -HW);

  const armAL = p.roll + p.spine + p.shL;
  const armAR = p.roll + p.spine + p.shR;
  const foreAL = armAL + p.elL;
  const foreAR = armAR + p.elR;
  const elL = add(shL, dir(armAL), UA * p.kUaL);
  const elR = add(shR, dir(armAR), UA * p.kUaR);
  const haL = add(elL, dir(foreAL), FA * p.kFaL);
  const haR = add(elR, dir(foreAR), FA * p.kFaR);

  const thighAL = p.roll + p.hipL;
  const thighAR = p.roll + p.hipR;
  const shinAL = thighAL + p.knL;
  const shinAR = thighAR + p.knR;
  const knL = add(hipL, dir(thighAL), TH * p.fsL * p.kThL);
  const knR = add(hipR, dir(thighAR), TH * p.fsR * p.kThR);
  const anL = add(knL, dir(shinAL), SH * p.fsL * p.kSnL);
  const anR = add(knR, dir(shinAR), SH * p.fsR * p.kSnR);

  // Ancrage au sol : le point le plus bas touche y = 0, puis on ajoute la hauteur de saut.
  const lows = [
    anL.y - 0.07 * h, anR.y - 0.07 * h, knL.y - 0.08 * h, knR.y - 0.08 * h,
    P.y - 0.13 * h, shL.y - 0.08 * h, shR.y - 0.08 * h, head.y - HR,
    haL.y - 0.05 * h, haR.y - 0.05 * h, elL.y - 0.05 * h, elR.y - 0.05 * h
  ];
  const lift = -Math.min(...lows) + p.air;
  const all = [P, neck, head, shL, shR, elL, elR, haL, haR, hipL, hipR, knL, knR, anL, anR];
  for (const v of all) {
    v.x += p.px;
    v.y += lift;
  }
  return {
    pelvis: P, neck, head, headR: HR, shL, shR, elL, elR, haL, haR, hipL, hipR, knL, knR, anL, anR,
    spineA, wrL: p.wrL, wrR: p.wrR, armAL, armAR, foreAL, foreAR, shinAL, shinAR, thighAL, thighAR, scale: h
  };
}

/* ---------------- Couleurs ---------------- */

const shadeCache = new Map<string, string>();
export function shade(hex: string, amt: number): string {
  const key = hex + amt;
  const c = shadeCache.get(key);
  if (c) return c;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  const out = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, out);
  return out;
}

/* ---------------- Dessin ---------------- */

export interface Placement {
  /** Position écran du point au sol sous le personnage (px). */
  sx: number;
  sy: number;
  /** Pixels par mètre. */
  s: number;
}

type Ctx = CanvasRenderingContext2D;

function capsulePath(ctx: Ctx, ax: number, ay: number, bx: number, by: number, ra: number, rb: number) {
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.arc(ax, ay, ra, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(bx, by, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

function limb(ctx: Ctx, a: V, b: V, ra: number, rb: number, color: string, pl: Placement, gloss = true) {
  const ax = pl.sx + a.x * pl.s;
  const ay = pl.sy - a.y * pl.s;
  const bx = pl.sx + b.x * pl.s;
  const by = pl.sy - b.y * pl.s;
  const RA = ra * pl.s;
  const RB = rb * pl.s;
  capsulePath(ctx, ax, ay, bx, by, RA, RB);
  if (gloss && RA > 2.5) {
    const ang = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = Math.cos(ang) * RA;
    const dy = Math.sin(ang) * RA;
    const g = ctx.createLinearGradient(mx - dx, my - dy, mx + dx, my + dy);
    g.addColorStop(0, shade(color, 0.16));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.32));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fill();
}

function pt(v: V, pl: Placement): [number, number] {
  return [pl.sx + v.x * pl.s, pl.sy - v.y * pl.s];
}

const lerpV = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export interface DrawOpts {
  facing: "front" | "back";
  /** Ombre au sol. */
  shadow?: boolean;
  /** Ballon tenu (basket) : position locale renvoyée par callback. */
  alpha?: number;
}

export function drawFigure(ctx: Ctx, sk: Skeleton, body: Body, kit: Kit, pl: Placement, opts: DrawOpts) {
  const h = sk.scale;
  const skin = body.skin;
  const back = opts.facing === "back";
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

  if (opts.shadow !== false) {
    const minY = Math.min(sk.anL.y, sk.anR.y, sk.pelvis.y, sk.head.y);
    const height = Math.max(0, minY - 0.05);
    const cx = (sk.pelvis.x + sk.neck.x) / 2;
    const spread = Math.abs(sk.head.x - sk.pelvis.x) + Math.abs(sk.anL.x - sk.anR.x) * 0.5 + 0.35;
    const k = Math.max(0.25, 1 - height * 0.9);
    ctx.fillStyle = `rgba(0,0,0,${0.32 * k})`;
    ctx.beginPath();
    ctx.ellipse(pl.sx + cx * pl.s, pl.sy, spread * pl.s * 0.85, 0.07 * pl.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const legSide = (side: "L" | "R") => {
    const hip = side === "L" ? sk.hipL : sk.hipR;
    const kn = side === "L" ? sk.knL : sk.knR;
    const an = side === "L" ? sk.anL : sk.anR;
    const shinA = side === "L" ? sk.shinAL : sk.shinAR;
    // cuisse (peau), genou, chaussette, crampon
    limb(ctx, hip, kn, 0.088 * h, 0.06 * h, skin, pl);
    const sockTop = lerpV(kn, an, 0.18);
    limb(ctx, kn, sockTop, 0.06 * h, 0.056 * h, skin, pl);
    limb(ctx, sockTop, an, 0.058 * h, 0.04 * h, kit.socks, pl);
    // bande de chaussette
    const band = lerpV(kn, an, 0.24);
    limb(ctx, sockTop, band, 0.06 * h, 0.059 * h, shade(kit.socks, -0.25), pl, false);
    // crampon
    const [ax, ay] = pt(an, pl);
    const toe = dir(shinA + (back ? 0 : 0));
    ctx.save();
    ctx.translate(ax + toe.x * 0.02 * pl.s, ay - toe.y * 0.02 * pl.s);
    ctx.rotate(-(shinA));
    ctx.fillStyle = kit.boots;
    ctx.beginPath();
    ctx.ellipse(0, 0.035 * pl.s, 0.062 * h * pl.s, 0.05 * h * pl.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(kit.boots, 0.35);
    ctx.fillRect(-0.05 * h * pl.s, 0.06 * pl.s, 0.1 * h * pl.s, 0.012 * pl.s + 0.6);
    ctx.restore();
  };
  legSide("L");
  legSide("R");

  // short : tronc + haut des cuisses
  const sk_ = sk;
  const thighCover = (hip: V, kn: V) => limb(ctx, hip, lerpV(hip, kn, 0.48), 0.105 * h, 0.092 * h, kit.shorts, pl);
  thighCover(sk_.hipL, sk_.knL);
  thighCover(sk_.hipR, sk_.knR);
  {
    const perp = dir(sk.spineA + Math.PI / 2);
    const up = dir(sk.spineA);
    const w = 0.17 * h;
    const a = add(add(sk.pelvis, perp, w), up, 0.1 * h);
    const b = add(add(sk.pelvis, perp, -w), up, 0.1 * h);
    const c = add(sk.hipR, dir(sk.thighAR), 0.12 * h);
    const d = add(sk.hipL, dir(sk.thighAL), 0.12 * h);
    ctx.fillStyle = kit.shorts;
    ctx.beginPath();
    ctx.moveTo(...pt(a, pl));
    ctx.lineTo(...pt(b, pl));
    ctx.lineTo(...pt(c, pl));
    ctx.lineTo(...pt(lerpV(sk.pelvis, add(sk.pelvis, dir(sk.spineA), -0.12 * h), 1), pl));
    ctx.lineTo(...pt(d, pl));
    ctx.closePath();
    ctx.fill();
  }

  // torse / maillot
  const perp = dir(sk.spineA + Math.PI / 2);
  const up = dir(sk.spineA);
  const chestW = 0.235 * h * (0.95 + body.bulk * 0.1);
  const waistW = 0.165 * h;
  const nL = add(sk.neck, perp, 0.07 * h);
  const nR = add(sk.neck, perp, -0.07 * h);
  const sL = add(add(sk.neck, perp, chestW), up, -0.06 * h);
  const sR = add(add(sk.neck, perp, -chestW), up, -0.06 * h);
  const wL = add(add(sk.pelvis, perp, waistW), up, 0.08 * h);
  const wR = add(add(sk.pelvis, perp, -waistW), up, 0.08 * h);
  const torsoPath = () => {
    ctx.beginPath();
    ctx.moveTo(...pt(nL, pl));
    const cL = add(add(sk.neck, perp, chestW * 0.75), up, 0.02 * h);
    ctx.quadraticCurveTo(...pt(cL, pl), ...pt(sL, pl));
    const mL = add(lerpV(sL, wL, 0.5), perp, 0.012 * h);
    ctx.quadraticCurveTo(...pt(mL, pl), ...pt(wL, pl));
    ctx.lineTo(...pt(wR, pl));
    const mR = add(lerpV(sR, wR, 0.5), perp, -0.012 * h);
    ctx.quadraticCurveTo(...pt(mR, pl), ...pt(sR, pl));
    const cR = add(add(sk.neck, perp, -chestW * 0.75), up, 0.02 * h);
    ctx.quadraticCurveTo(...pt(cR, pl), ...pt(nR, pl));
    const nk = add(sk.neck, up, back ? -0.01 * h : -0.05 * h);
    ctx.quadraticCurveTo(...pt(nk, pl), ...pt(nL, pl));
    ctx.closePath();
  };
  {
    torsoPath();
    const [x1, y1] = pt(sL, pl);
    const [x2, y2] = pt(sR, pl);
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, shade(kit.jersey, 0.12));
    g.addColorStop(0.5, kit.jersey);
    g.addColorStop(1, shade(kit.jersey, -0.28));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    torsoPath();
    ctx.clip();
    // dégradé vertical (volume)
    const [tx, ty] = pt(sk.neck, pl);
    const [bx, by] = pt(sk.pelvis, pl);
    const gv = ctx.createLinearGradient(tx, ty, bx, by);
    gv.addColorStop(0, "rgba(255,255,255,0.10)");
    gv.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = gv;
    ctx.fillRect(Math.min(x1, x2, bx) - 60, Math.min(ty, by) - 60, Math.abs(x2 - x1) + 200, Math.abs(by - ty) + 200);
    if (kit.pattern === "waves") {
      // vagues blanches en relief, comme le maillot ciel
      const [tx0, ty0] = pt(sk.neck, pl);
      const [tx1, ty1] = pt(sk.pelvis, pl);
      const top = Math.min(ty0, ty1) - 0.3 * h * pl.s;
      const bot = Math.max(ty0, ty1) + 0.3 * h * pl.s;
      const cx0 = (tx0 + tx1) / 2;
      const half = 0.4 * h * pl.s;
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = Math.max(0.6, 0.012 * h * pl.s);
      const step = 0.045 * h * pl.s;
      if (step > 1.6) {
        for (let y = top; y < bot; y += step) {
          ctx.beginPath();
          for (let x = cx0 - half; x <= cx0 + half; x += step * 0.5) {
            const yy = y + Math.sin((x - cx0) / (step * 1.6) + y * 0.05) * step * 0.45;
            if (x === cx0 - half) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }
    }
    if (kit.pattern === "flames") {
      // flammes blanches qui montent de la taille (maillot ciel des Léopards)
      const [nx, ny] = pt(sk.neck, pl);
      const [px0, py0] = pt(sk.pelvis, pl);
      const cx0 = (nx + px0) / 2;
      const span = Math.hypot(nx - px0, ny - py0);
      const half = 0.3 * h * pl.s;
      ctx.save();
      ctx.translate(px0, py0);
      ctx.rotate(-(sk.spineA - Math.PI));
      const g = ctx.createLinearGradient(0, 0, 0, -span);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.55, "rgba(255,255,255,0.75)");
      g.addColorStop(0.85, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineCap = "round";
      const n = 9;
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1)) * 2 - 1;
        const x0 = u * half;
        const tall = span * (0.95 - Math.abs(u) * 0.35);
        ctx.lineWidth = Math.max(0.8, 0.026 * h * pl.s * (1 - Math.abs(u) * 0.3));
        ctx.beginPath();
        ctx.moveTo(x0, 0.06 * h * pl.s);
        const steps = 6;
        for (let k = 1; k <= steps; k++) {
          const yy = -(tall * k) / steps;
          const xx = x0 * (1 - k / (steps * 1.6)) + Math.sin(k * 1.7 + i * 1.3) * 0.03 * h * pl.s;
          ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
      void cx0;
    }
    if (kit.sash) {
      // écharpe rouge liserée de jaune, de l'épaule gauche à la hanche droite
      const a = back ? sR : sL;
      const b = back ? wL : wR;
      const [ax, ay] = pt(add(a, up, 0.04 * h), pl);
      const [bx2, by2] = pt(add(b, up, -0.02 * h), pl);
      ctx.lineCap = "butt";
      ctx.strokeStyle = kit.sash.edge;
      ctx.lineWidth = 0.15 * h * pl.s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.strokeStyle = kit.sash.color;
      ctx.lineWidth = 0.11 * h * pl.s;
      ctx.stroke();
    } else {
      // épaules contrastées
      ctx.fillStyle = kit.jersey2;
      ctx.beginPath();
      ctx.moveTo(...pt(nL, pl));
      ctx.lineTo(...pt(sL, pl));
      ctx.lineTo(...pt(add(sL, up, -0.08 * h), pl));
      ctx.lineTo(...pt(add(sk.neck, up, -0.1 * h), pl));
      ctx.lineTo(...pt(add(sR, up, -0.08 * h), pl));
      ctx.lineTo(...pt(sR, pl));
      ctx.lineTo(...pt(nR, pl));
      ctx.closePath();
      ctx.fill();
    }
    if (kit.tank) {
      // débardeur : liseré d'emmanchure
      ctx.strokeStyle = kit.collar || kit.trim;
      ctx.lineWidth = Math.max(1, 0.02 * h * pl.s);
      torsoPath();
      ctx.stroke();
    }
    ctx.restore();
    // col
    ctx.strokeStyle = kit.collar || kit.trim;
    ctx.lineWidth = Math.max(1, 0.022 * h * pl.s);
    ctx.beginPath();
    ctx.moveTo(...pt(nL, pl));
    ctx.quadraticCurveTo(...pt(add(sk.neck, up, back ? -0.01 * h : -0.05 * h), pl), ...pt(nR, pl));
    ctx.stroke();
    // texte : numéro (et nom de dos)
    if (kit.number && pl.s * h > 30) {
      const [cx, cy] = pt(lerpV(sk.neck, sk.pelvis, back ? 0.5 : 0.42), pl);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-(sk.spineA - Math.PI));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = kit.trim;
      if (back) {
        if (kit.flag) {
          const w3 = 0.012 * h * pl.s;
          const top = -0.27 * h * pl.s;
          ctx.fillStyle = "#007fff";
          ctx.fillRect(-w3 * 1.5, top, w3, w3 * 3);
          ctx.fillStyle = "#f7d618";
          ctx.fillRect(-w3 * 0.5, top, w3, w3 * 3);
          ctx.fillStyle = "#ce1021";
          ctx.fillRect(w3 * 0.5, top, w3, w3 * 3);
          ctx.fillStyle = kit.trim;
        }
        if (kit.name && pl.s * h > 70) {
          ctx.font = `800 ${Math.round(0.062 * h * pl.s)}px Sora, system-ui, sans-serif`;
          ctx.fillText(kit.name.toUpperCase(), 0, -0.15 * h * pl.s, 0.4 * h * pl.s);
        }
        ctx.font = `${Math.round(0.24 * h * pl.s)}px 'Bebas Neue', Anton, system-ui, sans-serif`;
        ctx.lineWidth = Math.max(1, 0.012 * h * pl.s);
        ctx.strokeStyle = kit.numberStroke || shade(kit.jersey, -0.5);
        ctx.lineWidth = Math.max(1, 0.02 * h * pl.s);
        ctx.strokeText(kit.number, 0, 0.04 * h * pl.s);
        ctx.fillText(kit.number, 0, 0.04 * h * pl.s);
      } else if (kit.flag) {
        // drapeau de la RDC sur la poitrine + écusson
        const fw = 0.085 * h * pl.s;
        const fh = fw * 0.72;
        const fx = 0.03 * h * pl.s;
        const fy = -0.13 * h * pl.s;
        ctx.fillStyle = "#007fff";
        ctx.fillRect(fx, fy, fw, fh);
        ctx.strokeStyle = "#f7d618";
        ctx.lineWidth = fh * 0.34;
        ctx.beginPath();
        ctx.moveTo(fx, fy + fh);
        ctx.lineTo(fx + fw, fy);
        ctx.stroke();
        ctx.strokeStyle = "#ce1021";
        ctx.lineWidth = fh * 0.2;
        ctx.stroke();
        ctx.fillStyle = "#f7d618";
        ctx.beginPath();
        ctx.arc(fx + fw * 0.2, fy + fh * 0.25, fh * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(-0.09 * h * pl.s, fy + fh * 0.5, fh * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.font = `${Math.round((kit.pattern ? 0.2 : 0.11) * h * pl.s)}px 'Bebas Neue', Anton, system-ui, sans-serif`;
        if (kit.numberStroke) {
          ctx.strokeStyle = kit.numberStroke;
          ctx.lineWidth = Math.max(1, 0.015 * h * pl.s);
          ctx.strokeText(kit.number, kit.pattern ? 0 : -0.08 * h * pl.s, kit.pattern ? 0.02 * h * pl.s : -0.05 * h * pl.s);
        }
        ctx.fillText(kit.number, kit.pattern ? 0 : -0.08 * h * pl.s, kit.pattern ? 0.02 * h * pl.s : -0.05 * h * pl.s);
      }
      ctx.restore();
    }
  }

  // bras
  const arm = (side: "L" | "R") => {
    const sh = side === "L" ? sk.shL : sk.shR;
    const el = side === "L" ? sk.elL : sk.elR;
    const ha = side === "L" ? sk.haL : sk.haR;
    const foreA0 = side === "L" ? sk.foreAL : sk.foreAR;
    const foreA = foreA0 + (side === "L" ? sk.wrL : sk.wrR);
    if (kit.longSleeves) {
      limb(ctx, sh, el, 0.068 * h, 0.056 * h, kit.jersey, pl);
      limb(ctx, el, ha, 0.056 * h, 0.046 * h, kit.jersey, pl);
      limb(ctx, lerpV(el, ha, 0.15), lerpV(el, ha, 0.32), 0.058 * h, 0.054 * h, kit.jersey2, pl, false);
    } else {
      limb(ctx, sh, el, 0.058 * h, 0.048 * h, skin, pl);
      limb(ctx, el, ha, 0.047 * h, 0.036 * h, skin, pl);
      if (!kit.tank) {
        limb(ctx, sh, lerpV(sh, el, 0.48), 0.075 * h, 0.066 * h, kit.jersey, pl);
        if (kit.cuff) limb(ctx, lerpV(sh, el, 0.4), lerpV(sh, el, 0.5), 0.068 * h, 0.066 * h, kit.cuff, pl, false);
      }
    }
    if (kit.gloves) {
      // gant de gardien : manchette, paume large, doigts
      const fd = dir(foreA);
      const wrist = ha;
      const palm = add(ha, fd, 0.08 * h);
      const tip = add(ha, fd, 0.17 * h);
      limb(ctx, add(wrist, fd, -0.03 * h), add(wrist, fd, 0.03 * h), 0.058 * h, 0.06 * h, kit.gloves2 || "#111", pl, false);
      limb(ctx, add(wrist, fd, 0.03 * h), palm, 0.06 * h, 0.075 * h, kit.gloves, pl);
      limb(ctx, palm, tip, 0.075 * h, 0.06 * h, kit.gloves, pl);
      // pouce
      const side2 = side === "L" ? 1 : -1;
      const th = add(add(ha, fd, 0.06 * h), dir(foreA + (Math.PI / 2) * side2 * (back ? -1 : 1)), 0.065 * h);
      limb(ctx, add(ha, fd, 0.05 * h), th, 0.03 * h, 0.026 * h, kit.gloves, pl);
      if (pl.s * h > 60) {
        ctx.strokeStyle = shade(kit.gloves, -0.35);
        ctx.lineWidth = Math.max(0.6, 0.006 * h * pl.s);
        const pp = dir(foreA + Math.PI / 2);
        for (let i = -1; i <= 1; i++) {
          const a = add(add(palm, pp, i * 0.028 * h), fd, 0.02 * h);
          const b = add(add(tip, pp, i * 0.026 * h), fd, -0.01 * h);
          ctx.beginPath();
          ctx.moveTo(...pt(a, pl));
          ctx.lineTo(...pt(b, pl));
          ctx.stroke();
        }
      }
    } else {
      const fd = dir(foreA);
      limb(ctx, ha, add(ha, fd, 0.06 * h), 0.042 * h, 0.036 * h, shade(skin, -0.05), pl);
    }
  };
  arm("L");
  arm("R");

  // cou + tête
  limb(ctx, sk.neck, add(sk.neck, dir(sk.spineA), 0.08 * h), 0.052 * h, 0.048 * h, shade(skin, -0.12), pl, false);
  drawHead(ctx, sk, body, pl, back);
  ctx.restore();
}

function drawHead(ctx: Ctx, sk: Skeleton, body: Body, pl: Placement, back: boolean) {
  const [hx, hy] = pt(sk.head, pl);
  const r = sk.headR * pl.s;
  const rot = -(sk.spineA - Math.PI);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  // oreilles
  ctx.fillStyle = shade(body.skin, -0.1);
  ctx.beginPath();
  ctx.ellipse(-r * 0.95, r * 0.08, r * 0.2, r * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.95, r * 0.08, r * 0.2, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // visage
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, shade(body.skin, 0.12));
  g.addColorStop(1, shade(body.skin, -0.22));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // cheveux
  ctx.fillStyle = body.hair;
  ctx.beginPath();
  if (body.hairStyle === "bald") {
    // rien
  } else if (back) {
    // de dos : la chevelure couvre presque tout le crâne, nuque dégagée
    ctx.save();
    ctx.beginPath();
    ctx.rect(-r * 1.2, -r * 1.3, r * 2.4, r * 1.78);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.02, r * 0.93, r * 1.03, 0, 0, Math.PI * 2);
    ctx.fillStyle = body.hair;
    ctx.fill();
    if (body.hairStyle === "fade") {
      const fg = ctx.createLinearGradient(0, r * 0.05, 0, r * 0.48);
      fg.addColorStop(0, "rgba(0,0,0,0)");
      fg.addColorStop(1, body.skin);
      ctx.fillStyle = fg;
      ctx.fillRect(-r, r * 0.05, r * 2, r * 0.45);
    }
    // reflet
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.5, r * 0.35, r * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    if (body.hairStyle === "locks") {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(i * r * 0.24 - r * 0.07, r * 0.1, r * 0.14, r * (0.75 - Math.abs(i) * 0.06));
      }
    }
  } else {
    ctx.ellipse(0, -r * 0.18, r * 0.93, r * 0.85, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    if (body.hairStyle === "locks") {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) ctx.fillRect(sx * r * (0.72 + i * 0.1) - r * 0.07, -r * 0.1, r * 0.13, r * (0.75 - i * 0.12));
      }
    }
  }
  if (body.hairStyle === "bun") {
    // chignon de la joueuse
    ctx.fillStyle = body.hair;
    ctx.beginPath();
    if (back) ctx.arc(0, -r * 0.55, r * 0.46, 0, Math.PI * 2);
    else ctx.arc(0, -r * 1.02, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  if (body.headband) {
    ctx.fillStyle = body.headband;
    ctx.fillRect(-r * 0.92, -r * 0.48, r * 1.84, r * 0.2);
  }
  if (!back && r > 4.5) {
    // traits du visage
    ctx.fillStyle = "rgba(20,12,8,0.85)";
    const ey = -r * 0.05;
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, ey, r * 0.11, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.34, ey, r * 0.11, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    if (r > 9) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-r * 0.31, ey - r * 0.02, r * 0.03, 0, Math.PI * 2);
      ctx.arc(r * 0.37, ey - r * 0.02, r * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(body.hair, 0.1);
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, ey - r * 0.2);
      ctx.lineTo(-r * 0.18, ey - r * 0.16);
      ctx.moveTo(r * 0.5, ey - r * 0.2);
      ctx.lineTo(r * 0.18, ey - r * 0.16);
      ctx.stroke();
      ctx.strokeStyle = shade(body.skin, -0.35);
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.04, ey + r * 0.12);
      ctx.lineTo(-r * 0.1, ey + r * 0.36);
      ctx.lineTo(r * 0.06, ey + r * 0.38);
      ctx.stroke();
      ctx.strokeStyle = "rgba(60,20,20,0.7)";
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, r * 0.58);
      ctx.quadraticCurveTo(0, r * 0.66, r * 0.22, r * 0.58);
      ctx.stroke();
    }
  }
  ctx.restore();
}


/* ---------------- Modèle sagittal (course, frappe) ----------------
 * Les membres bougent surtout « en profondeur » quand on voit un joueur de dos :
 * on décrit donc chaque segment par son tangage avant/arrière, puis on le projette
 * (raccourci + légère remontée quand il s'éloigne de la caméra, placée en hauteur).
 */
export interface Sag {
  /** Cuisse (tangage, + = vers l'avant) et flexion du genou, par jambe. */
  lt: number; lf: number; rt: number; rf: number;
  /** Bras (tangage) et flexion du coude. */
  la: number; lb: number; ra: number; rb: number;
  /** Écartement latéral bras / jambes. */
  aoL: number; aoR: number; loL: number; loR: number;
  lean: number; roll: number; spine: number; air: number; px: number; head: number;
}

export const SAG0: Sag = {
  lt: 0, lf: 0.1, rt: 0, rf: 0.1, la: 0, lb: 0.25, ra: 0, rb: 0.25,
  aoL: -0.2, aoR: 0.2, loL: -0.07, loR: 0.07,
  lean: 0.05, roll: 0, spine: 0, air: 0, px: 0, head: 0
};

export const sag = (p: Partial<Sag>): Sag => ({ ...SAG0, ...p });

const SAG_KEYS = Object.keys(SAG0) as (keyof Sag)[];
export function lerpSag(a: Sag, b: Sag, t: number): Sag {
  const o = {} as Sag;
  for (const k of SAG_KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

function projSeg(pitch: number, out: number, E: number) {
  const vy = Math.cos(pitch) - E * Math.sin(pitch);
  const k = Math.max(0.12, Math.abs(vy));
  const sgn = out < 0 ? -1 : 1;
  const a = vy >= 0 ? out : sgn * (Math.PI - Math.abs(out));
  return { a, k };
}

/** Convertit une description sagittale en pose écran (vue de dos par défaut). */
export function sagPose(s: Sag, facing: "back" | "front" = "back"): Pose {
  const E = facing === "back" ? 0.3 : -0.3;
  const tL = projSeg(s.lt, s.loL, E);
  const sL = projSeg(s.lt - s.lf, s.loL * 0.4, E);
  const tR = projSeg(s.rt, s.loR, E);
  const sR = projSeg(s.rt - s.rf, s.loR * 0.4, E);
  const uL = projSeg(s.la, s.aoL, E);
  const fL = projSeg(s.la + s.lb, s.aoL * 0.5, E);
  const uR = projSeg(s.ra, s.aoR, E);
  const fR = projSeg(s.ra + s.rb, s.aoR * 0.5, E);
  return {
    ...BASE_POSE,
    roll: s.roll, px: s.px, air: s.air, spine: s.spine, lean: s.lean, head: s.head,
    hipL: tL.a, knL: sL.a - tL.a, kThL: tL.k, kSnL: sL.k,
    hipR: tR.a, knR: sR.a - tR.a, kThR: tR.k, kSnR: sR.k,
    shL: uL.a, elL: fL.a - uL.a, kUaL: uL.k, kFaL: fL.k,
    shR: uR.a, elR: fR.a - uR.a, kUaR: uR.k, kFaR: fR.k
  };
}

/**
 * Cycle de course. phase en radians (2π = deux appuis).
 * Jambe en suspension : genou qui monte devant, talon qui remonte derrière ;
 * bras opposés, coudes pliés à ~90°, buste penché, léger roulis des épaules.
 */
export function runSag(phase: number, intensity = 1, armsOut = 0): Sag {
  const leg = (p: number) => {
    const t = 0.55 * Math.sin(p) * intensity;
    const swing = Math.max(0, Math.cos(p));
    const f = 0.25 + 1.35 * Math.pow(swing, 1.4) * intensity + (Math.sin(p) > 0 ? 0.15 * Math.sin(p) : 0);
    return { t, f };
  };
  const L = leg(phase);
  const R = leg(phase + Math.PI);
  const arm = (p: number) => -0.7 * Math.sin(p) * intensity;
  return {
    ...SAG0,
    lt: L.t, lf: L.f, rt: R.t, rf: R.f,
    la: arm(phase) * (1 - armsOut), lb: 1.35 * (1 - armsOut) + 0.1,
    ra: arm(phase + Math.PI) * (1 - armsOut), rb: 1.35 * (1 - armsOut) + 0.1,
    aoL: -0.18 - armsOut * 1.25, aoR: 0.18 + armsOut * 1.25,
    loL: -0.05, loR: 0.05,
    lean: 0.32 * intensity,
    roll: 0.05 * Math.sin(phase) * intensity,
    spine: -0.03 * Math.sin(phase) * intensity,
    air: 0.045 * Math.abs(Math.sin(phase)) * intensity,
    head: 0
  };
}

/** Frappe du pied droit, vue de dos : appui, armé, contact, accompagnement. */
export const KICK = {
  idle: sag({ lt: 0.02, lf: 0.08, rt: -0.04, rf: 0.12, la: 0.05, lb: 0.2, ra: -0.05, rb: 0.2, aoL: -0.32, aoR: 0.32, loL: -0.1, loR: 0.1, lean: 0.06 }),
  ready: sag({ lt: 0.1, lf: 0.3, rt: -0.15, rf: 0.35, la: 0.2, lb: 0.6, ra: -0.1, rb: 0.6, aoL: -0.3, aoR: 0.3, loL: -0.08, loR: 0.12, lean: 0.25 }),
  plant: sag({ lt: 0.45, lf: 0.55, rt: -0.75, rf: 1.75, la: 0.35, lb: 0.3, ra: -0.55, rb: 0.6, aoL: -1.05, aoR: 0.45, loL: -0.04, loR: 0.16, lean: 0.12, roll: 0.14, spine: -0.06 }),
  strike: sag({ lt: 0.08, lf: 0.35, rt: 0.35, rf: 0.25, la: 0.1, lb: 0.2, ra: 0.2, rb: 0.5, aoL: -1.35, aoR: 0.55, loL: -0.06, loR: -0.05, lean: 0.02, roll: 0.1, spine: -0.04 }),
  follow: sag({ lt: 0.0, lf: 0.25, rt: 1.15, rf: 0.25, la: -0.2, lb: 0.4, ra: 0.6, rb: 0.6, aoL: -1.25, aoR: 0.35, loL: -0.06, loR: -0.12, lean: -0.08, roll: 0.06, air: 0.05 }),
  land: sag({ lt: 0.05, lf: 0.3, rt: 0.4, rf: 0.6, la: 0.1, lb: 0.5, ra: 0.3, rb: 0.6, aoL: -0.6, aoR: 0.4, loL: -0.08, loR: 0.06, lean: 0.15 })
};

/* ---------------- Poses de référence ---------------- */

export const POSES = {
  // Gardien
  keeperReady: pose({ lean: 0.35, shL: -0.38, elL: -0.42, shR: 0.38, elR: 0.42, wrL: -1.35, wrR: 1.35, hipL: -0.34, knL: 0.46, hipR: 0.34, knR: -0.46 }),
  keeperSet: pose({ lean: 0.5, air: 0.05, shL: -0.5, elL: -0.5, shR: 0.5, elR: 0.5, wrL: -1.3, wrR: 1.3, hipL: -0.42, knL: 0.62, hipR: 0.42, knR: -0.62 }),
  keeperLoadR: pose({ lean: 0.45, px: 0.18, roll: -0.12, shL: -0.7, elL: -0.6, shR: 1.1, elR: 0.3, hipL: -0.5, knL: 0.5, hipR: 0.25, knR: -0.75 }),
  diveLowR: pose({ roll: -1.38, air: 0.02, spine: 0.04, head: 0.15, shL: -2.85, elL: -0.05, shR: 2.95, elR: 0.05, hipL: -0.12, knL: 0.2, hipR: 0.28, knR: -0.7 }),
  diveMidR: pose({ roll: -1.12, air: 0.42, spine: 0.06, head: 0.12, shL: -2.8, elL: -0.06, shR: 2.95, elR: 0.04, hipL: -0.1, knL: 0.25, hipR: 0.35, knR: -0.9 }),
  diveHighR: pose({ roll: -0.72, air: 0.62, spine: 0.05, head: 0.1, shL: -2.85, elL: -0.05, shR: 2.98, elR: 0.02, hipL: -0.05, knL: 0.15, hipR: 0.75, knR: -1.35 }),
  lieR: pose({ roll: -1.52, air: 0, head: 0.25, shL: -2.5, elL: -0.4, shR: 2.7, elR: 0.3, hipL: -0.1, knL: 0.3, hipR: 0.2, knR: -0.5 }),
  keeperStay: pose({ lean: 0.55, shL: -0.45, elL: 0.55, shR: 0.45, elR: -0.55, hipL: -0.4, knL: 0.7, hipR: 0.4, knR: -0.7 }),
  keeperJumpUp: pose({ air: 0.45, shL: -2.75, elL: -0.1, shR: 2.75, elR: 0.1, hipL: -0.12, knL: 0.5, hipR: 0.12, knR: -0.5 }),
  keeperCheer: pose({ shL: -2.55, elL: -0.35, shR: 2.55, elR: 0.35, hipL: -0.2, knL: 0.1, hipR: 0.2, knR: -0.1 }),
  keeperSad: pose({ head: 0.3, lean: 0.2, shL: -2.45, elL: -2.3, shR: 2.45, elR: 2.3, hipL: -0.1, knL: 0.05, hipR: 0.1, knR: -0.05 }),
  // Mur défensif
  wall: pose({ shL: -0.22, elL: 0.95, shR: 0.22, elR: -0.95, hipL: -0.05, knL: 0.03, hipR: 0.05, knR: -0.03 }),
  wallJump: pose({ air: 0.38, shL: -0.3, elL: 1.05, shR: 0.3, elR: -1.05, hipL: -0.04, knL: 0.35, hipR: 0.04, knR: -0.35 }),
  // Tireur (vu de dos)
  shooterIdle: pose({ shL: -0.25, elL: -0.15, shR: 0.25, elR: 0.15, hipL: -0.12, knL: 0.05, hipR: 0.12, knR: -0.05 }),
  shooterRunA: pose({ lean: 0.2, shL: -0.9, elL: 1.1, shR: 0.7, elR: -1.0, hipL: -0.2, knL: 0.2, hipR: 0.35, knR: 2.4, fsR: 0.9 }),
  shooterRunB: pose({ lean: 0.2, shL: 0.6, elL: 1.0, shR: -0.5, elR: -1.0, hipL: 0.3, knL: -2.4, hipR: 0.05, knR: 0.1, fsL: 0.9 }),
  shooterBackswing: pose({ lean: 0.15, roll: 0.08, shL: -1.25, elL: -0.2, shR: 0.55, elR: 0.6, hipL: -0.05, knL: 0.1, hipR: 0.3, knR: 2.6, fsR: 0.85 }),
  shooterStrike: pose({ lean: 0.1, roll: 0.06, shL: -1.4, elL: -0.15, shR: 0.7, elR: 0.4, hipL: -0.08, knL: 0.15, hipR: -0.35, knR: 0.1, fsR: 0.62 }),
  shooterFollow: pose({ lean: 0.05, air: 0.04, roll: 0.05, shL: -1.2, elL: -0.3, shR: 0.9, elR: 0.5, hipL: -0.05, knL: 0.1, hipR: -0.2, knR: 0.2, fsR: 0.35 }),
  shooterCheer: pose({ shL: -2.7, elL: -0.2, shR: 2.7, elR: 0.2, hipL: -0.15, knL: 0.05, hipR: 0.15, knR: -0.05 }),
  shooterSad: pose({ head: 0.3, shL: -2.4, elL: -2.4, shR: 2.4, elR: 2.4, hipL: -0.1, hipR: 0.1 }),
  // Basket (tireur de dos)
  hoopDribble: pose({ lean: 0.25, shL: -0.4, elL: 0.6, shR: 0.35, elR: -0.2, hipL: -0.28, knL: 0.4, hipR: 0.28, knR: -0.4 }),
  hoopGather: pose({ lean: 0.2, shL: -0.6, elL: 1.4, shR: 0.6, elR: -1.4, hipL: -0.3, knL: 0.55, hipR: 0.3, knR: -0.55 }),
  hoopSet: pose({ lean: 0.1, shL: -2.55, elL: -1.45, shR: 2.6, elR: 1.5, hipL: -0.32, knL: 0.6, hipR: 0.32, knR: -0.6 }),
  hoopRelease: pose({ air: 0.38, shL: -2.85, elL: -0.25, shR: 3.0, elR: 0.05, hipL: -0.06, knL: 0.15, hipR: 0.06, knR: -0.15 }),
  hoopLand: pose({ lean: 0.2, shL: -2.2, elL: -0.4, shR: 2.4, elR: 0.6, hipL: -0.25, knL: 0.4, hipR: 0.25, knR: -0.4 }),
  // Défenseur (de face)
  guard: pose({ lean: 0.35, shL: -1.35, elL: -0.25, shR: 1.35, elR: 0.25, hipL: -0.38, knL: 0.5, hipR: 0.38, knR: -0.5 }),
  // Célébrations
  kneeSlide: pose({ lean: -0.15, head: -0.15, hipL: -0.32, knL: 2.6, hipR: 0.32, knR: -2.6, kSnL: 0.35, kSnR: 0.35, kThL: 0.9, kThR: 0.9, shL: -2.3, elL: -0.25, shR: 2.3, elR: 0.25 }),
  thumbsName: pose({ head: -0.25, shL: -2.45, elL: 2.35, shR: 2.45, elR: -2.35, hipL: -0.12, hipR: 0.12 }),
  fistPump: pose({ head: -0.1, shL: -0.7, elL: 1.9, shR: 2.95, elR: 0.12, hipL: -0.14, knL: 0.1, hipR: 0.14, knR: -0.1 }),
  contest: pose({ air: 0.5, shL: -2.95, elL: 0, shR: 2.6, elR: 0.4, hipL: -0.08, knL: 0.45, hipR: 0.1, knR: -0.4 })
};

/**
 * Fimbu : la danse des Léopards. Jambes fléchies très écartées, bras tendus à l'horizontale,
 * l'avant-bras qui claque comme un fouet d'un côté puis de l'autre, buste qui balance en rythme.
 */
export function fimbuPose(t: number, offset = 0): Pose {
  const b = t * Math.PI * 2 * 1.05 + offset;
  const s = Math.sin(b);
  const bounce = Math.abs(Math.sin(b));
  const whipL = Math.max(0, -s);
  const whipR = Math.max(0, s);
  return pose({
    roll: 0.14 * s,
    px: 0.1 * s,
    air: 0.02 * bounce,
    lean: 0.12,
    head: -0.12 * s,
    spine: -0.05 * s,
    hipL: -0.62, knL: 0.82 + 0.18 * bounce,
    hipR: 0.62, knR: -0.82 - 0.18 * bounce,
    shL: -1.5 - 0.12 * s, elL: -1.55 * whipL,
    shR: 1.5 - 0.12 * s, elR: 1.55 * whipR,
    wrL: -0.3, wrR: 0.3
  });
}

/* ---------------- Personnages ---------------- */

/** Maillot ciel des Léopards (flammes blanches, col et manches rouges, numéro rouge liseré de blanc). */
export const LEOPARDS_KIT = (name: string, number: number, boots = "#1e40af"): Kit => ({
  jersey: "#2fa2e3",
  jersey2: "#1d8bd0",
  trim: "#e0263a",
  collar: "#e0263a",
  cuff: "#e0263a",
  shorts: "#2fa2e3",
  socks: "#2fa2e3",
  boots,
  pattern: "flames",
  flag: true,
  numberStroke: "#ffffff",
  number: String(number),
  name
});

/** Maillot basket des Léopards : bleu roi, nom et numéro jaunes liserés de rouge. */
export const LEOPARDS_BASKET_KIT = (name: string, number: number): Kit => ({
  jersey: "#1d4fd8",
  jersey2: "#163fae",
  trim: "#f7d618",
  collar: "#d81e27",
  numberStroke: "#d81e27",
  shorts: "#1d4fd8",
  socks: "#f8fafc",
  boots: "#f8fafc",
  tank: true,
  number: String(number),
  name
});

export const RIVAL_KIT: Kit = {
  jersey: "#f8fafc",
  jersey2: "#16a34a",
  trim: "#16a34a",
  shorts: "#f8fafc",
  socks: "#16a34a",
  boots: "#111827"
};

export const RIVAL_BASKET_KIT: Kit = {
  jersey: "#b91c1c",
  jersey2: "#7f1d1d",
  trim: "#fef2f2",
  shorts: "#b91c1c",
  socks: "#f8fafc",
  boots: "#f8fafc",
  tank: true,
  number: "7"
};

/** Silhouette de la joueuse (2D). */
export const FEMALE_BODY: Body = { skin: "#6b4128", hair: "#120c08", hairStyle: "bun", height: 1.74, bulk: 0.2 };

export const BODIES: Body[] = [
  { skin: "#6b4128", hair: "#120c08", hairStyle: "fade", height: 1.86, bulk: 0.6 },
  { skin: "#4a2c1a", hair: "#0d0805", hairStyle: "short", height: 1.9, bulk: 0.8 },
  { skin: "#7a4b2e", hair: "#120c08", hairStyle: "locks", height: 1.84, bulk: 0.5 },
  { skin: "#5a3520", hair: "#0d0805", hairStyle: "bald", height: 1.88, bulk: 0.7 },
  { skin: "#3d2416", hair: "#0d0805", hairStyle: "fade", height: 1.92, bulk: 0.9 }
];
