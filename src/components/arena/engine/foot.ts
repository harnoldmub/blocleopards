/**
 * Tirs au but — moteur de jeu (canvas 2D, perspective « caméra derrière le tireur »).
 * Un tir à la fois : le shell React gère la série, le score et les combos.
 */
import type { DiffCfg, FootStage } from "../lib/config";
import { audio } from "../lib/audio";
import { clamp, easeInOut, easeOutCubic, gauss, lerp, mulberry32 } from "../lib/rng";
import {
  BODIES, FEMALE_BODY, KICK, LEOPARDS_KIT, POSES, RIVAL_KIT, drawFigure, fimbuPose, lerpPose, lerpSag, mirrorPose, runSag, sagPose, skeleton,
  type Body, type Sag, type Kit, type Pose, type Skeleton, type V
} from "./people";
import {
  Camera, LOGO_BL, brandImage, confettiBurst, crowdRow, drawBrandPanel, drawFootball, drawParticles, drawPartnerPanel,
  dustBurst, onBrandLoad, updateParticles, type Particle
} from "./scene";
import type { Actor, Chars3D } from "./chars3d";

type C3Mod = typeof import("./chars3d");

export interface FootSetup {
  stage: FootStage;
  diff: DiffCfg;
  seed: number;
  shot: number;
  name: string;
  number: number;
  reduced: boolean;
  /** Zones visées précédemment (-1 gauche, 0 centre, 1 droite) : le gardien apprend. */
  history: number[];
  /** Dernier tir de la série : un but déclenche le fimbu collectif. */
  finale?: boolean;
  female?: boolean;
}

export interface ShotOutcome {
  scored: boolean;
  base: number;
  tags: string[];
  label: string;
  detail: string;
  zone: number;
}

export interface EngineCallbacks {
  onKick: () => void;
  onResult: (o: ShotOutcome) => void;
  onAim?: (aiming: boolean) => void;
}

const G = 9.81;
const BALL_R = 0.11;
const GOAL_W = 3.66;
const GOAL_H = 2.44;
const KEEPER_DZ = 0.4;
/** Durée de l'élan (s) entre le geste et le contact avec le ballon. */
const RUN = 0.72;

type Phase = "aim" | "runup" | "flight" | "done";

/* ---------- Physique du ballon : gravité, traînée de l'air, effet Magnus ---------- */
interface V3 { x: number; y: number; z: number }
/** Traînée quadratique : ½·ρ·Cd·A / m pour un ballon taille 5 (≈ 0,0125 /m). */
const KD = 0.0125;
/** Coefficient Magnus : accélération = CM · (ω × v). */
const CM = 0.006;
/** Amortissement de la rotation (1/s). */
const SPIN_DECAY = 0.35;

function ballAccel(v: V3, w: V3): V3 {
  const sp = Math.hypot(v.x, v.y, v.z);
  return {
    x: -KD * sp * v.x + CM * (w.y * v.z - w.z * v.y),
    y: -G - KD * sp * v.y + CM * (w.z * v.x - w.x * v.z),
    z: -KD * sp * v.z + CM * (w.x * v.y - w.y * v.x)
  };
}

/** Simule la trajectoire jusqu'au plan Z donné (rebonds au sol inclus). */
function flyTo(p0: V3, v0: V3, w0: V3, zPlane: number, samples?: V3[]): { x: number; y: number; t: number } {
  const p = { ...p0 };
  const v = { ...v0 };
  const w = { ...w0 };
  const dt = 1 / 240;
  let t = 0;
  let i = 0;
  while (p.z < zPlane && t < 4) {
    const a = ballAccel(v, w);
    v.x += a.x * dt;
    v.y += a.y * dt;
    v.z += a.z * dt;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    const k = 1 - SPIN_DECAY * dt;
    w.x *= k;
    w.y *= k;
    if (p.y < BALL_R && v.y < 0) {
      p.y = BALL_R;
      v.y = -v.y * 0.52;
      v.x *= 0.85;
      v.z *= 0.82;
    }
    t += dt;
    if (samples && i++ % 8 === 0) samples.push({ ...p });
  }
  if (samples) samples.push({ ...p });
  return { x: p.x, y: p.y, t };
}

/** Cherche la vitesse initiale qui amène le ballon au point visé malgré traînée et effet. */
function solveShot(p0: V3, tx: number, ty: number, D: number, speed: number, w: V3): V3 {
  const T = Math.hypot(D - p0.z, tx - p0.x) / speed;
  const v = { x: (tx - p0.x) / T, y: (ty - p0.y + 0.5 * G * T * T) / T, z: ((D - p0.z) / T) * 1.06 };
  for (let i = 0; i < 10; i++) {
    const r = flyTo(p0, v, w, D);
    const ex = tx - r.x;
    const ey = ty - r.y;
    if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) break;
    v.x += ex / Math.max(0.2, r.t);
    v.y += ey / Math.max(0.2, r.t);
  }
  return v;
}

interface DiveSpec {
  side: 1 | -1;
  kind: "low" | "mid" | "high" | "stay" | "jump";
  px: number;
  air: number;
  start: number;
  tx: number;
  ty: number;
  /** Temps de vol jusqu'au plan du gardien (s). */
  arrive: number;
}

export class FootEngine {
  private ctx: CanvasRenderingContext2D;
  private cam = new Camera();
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private bgDirty = true;
  private setupData!: FootSetup;
  private rng = mulberry32(1);
  private t = 0;
  private phase: Phase = "aim";
  private phaseT = 0;
  private parts: Particle[] = [];
  private unsub: () => void;

  // tireur / gardien
  private shooterBody: Body = BODIES[0];
  private shooterKit: Kit = LEOPARDS_KIT("LÉOPARD", 10);
  private keeperBody: Body = BODIES[1];
  private keeperKit!: Kit;
  private keeperX = 0;
  private dive: DiveSpec | null = null;
  private keeperRead = false;
  private keeperSk: Skeleton | null = null;
  private kickT = 0;
  private wallBodies: Body[] = [];

  // ballon
  private bx = 0;
  private by = BALL_R;
  private bz = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private ax = 0;
  private spin = 0;
  private omega: V3 = { x: 0, y: 0, z: 0 };
  private ballHeld = false;
  private crossedKeeper = false;
  private crossedWall = false;
  private crossedGoal = false;
  private inNet = false;
  private trail: { x: number; y: number; r: number }[] = [];

  // tir en préparation
  private pending: { tx: number; ty: number; v: number; ax: number; w: V3; zone: number; over: boolean } | null = null;
  private outcome: ShotOutcome | null = null;
  private resultSent = false;
  private resolvedAt = 0;

  // geste
  private touch: { pts: { x: number; y: number; t: number }[] } | null = null;
  private fingerTrail: { x: number; y: number; t: number }[] = [];
  private zoom = 1;
  private shake = 0;

  // personnages 3D (facultatifs : repli 2D si WebGL indisponible)
  private c3: Chars3D | null = null;
  private c3m: C3Mod | null = null;
  private A: { shooter?: Actor; keeper?: Actor; wall: Actor[]; mates: Actor[] } = { wall: [], mates: [] };
  private celeb = { x: 0, z: 0, captured: false };
  private viewOff = { x: 0, y: 0 };

  attach3D(c3: Chars3D, mod: C3Mod) {
    this.c3 = c3;
    this.c3m = mod;
    if (this.setupData) this.build3D();
  }

  get use3d() {
    return !!(this.c3 && this.c3.ready && this.A.shooter && this.A.keeper);
  }

  private build3D() {
    const c3 = this.c3;
    const m = this.c3m;
    if (!c3 || !m || !c3.ready) return;
    c3.clearActors();
    const s = this.setupData;
    this.A = { wall: [], mates: [] };
    this.A.shooter = c3.actor({ ...m.LEOPARDS_PAINT(s.name, s.number, this.shooterBody.skin), female: !!s.female });
    // « La Pieuvre » utilise aussi le modèle féminin : la joueuse peut donc
    // apparaître aussi bien au tir que dans les buts.
    this.A.keeper = c3.actor({
      ...m.KEEPER_PAINT(s.stage.keeper.kit, this.keeperBody.skin),
      female: s.stage.keeper.nickname === "La Pieuvre"
    });
    for (let i = 0; i < s.stage.wall; i++) this.A.wall.push(c3.actor(m.RIVAL_PAINT(4 + i * 3, this.wallBodies[i].skin)));
    this.celeb = { x: 0, z: 0, captured: false };
    c3.buildGoal(this.D);
    this.drive3D();
  }

  constructor(private canvas: HTMLCanvasElement, private cb: EngineCallbacks) {
    this.ctx = canvas.getContext("2d")!;
    this.unsub = onBrandLoad(() => (this.bgDirty = true));
  }

  destroy() {
    this.unsub();
  }

  /* ------------------------------------------------------------------ */
  /* Mise en place                                                      */
  /* ------------------------------------------------------------------ */

  setup(s: FootSetup) {
    this.setupData = s;
    this.rng = mulberry32(s.seed * 31 + s.shot * 7919 + 17);
    this.phase = "aim";
    this.phaseT = 0;
    this.outcome = null;
    this.resultSent = false;
    this.pending = null;
    this.dive = null;
    this.keeperRead = false;
    this.crossedKeeper = this.crossedWall = this.crossedGoal = this.inNet = false;
    this.ballHeld = false;
    this.trail = [];
    this.curve = [];
    this.parts = [];
    this.zoom = 1;
    this.shake = 0;
    this.bx = s.stage.ballX;
    this.by = BALL_R;
    this.bz = 0;
    this.vx = this.vy = this.vz = this.ax = 0;
    this.omega = { x: 0, y: 0, z: 0 };
    this.shooterBody = s.female ? FEMALE_BODY : BODIES[(s.number + s.name.length) % BODIES.length];
    this.shooterKit = LEOPARDS_KIT(s.name, s.number);
    this.keeperBody = { ...BODIES[(s.stage.id + 1) % BODIES.length], height: 1.9 + s.stage.id * 0.01, bulk: 0.8 };
    const k = s.stage.keeper.kit;
    this.keeperKit = {
      jersey: k.jersey, jersey2: k.jersey2, trim: k.trim, shorts: k.shorts, socks: k.socks,
      boots: "#111827", gloves: k.gloves, gloves2: k.gloves2, longSleeves: true, number: "1"
    };
    this.keeperX = s.stage.ballX * 0.12;
    this.wallBodies = Array.from({ length: s.stage.wall }, (_, i) => BODIES[(i * 2 + 1) % BODIES.length]);
    this.bgDirty = true;
    this.layout();
    if (this.c3?.ready) this.build3D();
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.bgDirty = true;
    if (this.setupData) this.layout();
  }

  private get D() {
    return this.setupData.stage.distance;
  }

  private wallZ() {
    return Math.min(9.15, this.D - 3);
  }

  private wallXs(): number[] {
    const n = this.setupData.stage.wall;
    if (!n) return [];
    const bx = this.setupData.stage.ballX;
    const side = bx <= 0 ? -1 : 1;
    const nearPost = side * GOAL_W;
    const t = this.wallZ() / this.D;
    const edge = bx + (nearPost + side * 0.25 - bx) * t;
    return Array.from({ length: n }, (_, i) => edge - side * (0.27 + i * 0.52));
  }

  private layout() {
    const cam = this.cam;
    const D = this.D;
    const bx = this.setupData.stage.ballX;
    // caméra TV : un peu à droite et en retrait du ballon, le tireur reste à gauche de l'axe
    cam.x = D > 15 ? bx - 0.9 : bx + 0.55;
    cam.y = D > 15 ? 4.6 : 3.9;
    cam.z = D > 15 ? -9 : -11;
    cam.setYaw(Math.atan2(-cam.x * 0.85, D - cam.z));
    cam.cx = this.w / 2;
    // cadrage : cage le plus large possible, ballon en bas
    const pts = [
      [-GOAL_W - 0.3, GOAL_H, D],
      [GOAL_W + 0.3, GOAL_H, D],
      [bx, 0, 0]
    ];
    const uv = pts.map(([X, Y, Z]) => {
      const [rx, rz] = cam.rel(X, Z);
      return { u: rx / rz, v: -(Y - cam.y) / rz };
    });
    const uSpan = Math.abs(uv[1].u - uv[0].u);
    const vSpan = uv[2].v - Math.min(uv[0].v, uv[1].v);
    const portrait = this.h > this.w;
    // cadrage large sur mobile : on voit la cage, le gardien et les panneaux partenaires de part et d'autre
    const fW = (this.w * (portrait ? 0.76 : 0.58)) / uSpan;
    const fH = (this.h * 0.52) / vSpan;
    cam.f = Math.min(fW, fH);
    const ballY = this.h * (portrait ? (D > 15 ? 0.7 : 0.8) : D > 15 ? 0.78 : 0.84);
    cam.hz = ballY - uv[2].v * cam.f;
    // centre la cage horizontalement
    const mid = (uv[0].u + uv[1].u) / 2;
    cam.cx = this.w / 2 - mid * cam.f;
  }

  /* ------------------------------------------------------------------ */
  /* Décor pré-rendu                                                    */
  /* ------------------------------------------------------------------ */

  private renderBackground() {
    const W = this.w;
    const H = this.h;
    if (!this.bg) this.bg = document.createElement("canvas");
    this.bg.width = Math.round(W * this.dpr);
    this.bg.height = Math.round(H * this.dpr);
    const ctx = this.bg.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cam = this.cam;
    const D = this.D;
    const final = this.setupData.stage.id === 5 || this.setupData.stage.id <= 0;

    // ciel nocturne
    const sky = ctx.createLinearGradient(0, 0, 0, cam.hz);
    sky.addColorStop(0, "#020617");
    sky.addColorStop(1, "#0b1a3a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // tribunes : rangées en gradins derrière le but
    const boardZ = D + 3.2;
    const standZ0 = D + 7;
    const rows = 46;
    let prevY = cam.p(0, 1.2, standZ0).y;
    const left = -60;
    const right = 60;
    // façade sous les tribunes
    const fac = cam.p(0, 0, standZ0);
    ctx.fillStyle = "#0a1226";
    ctx.fillRect(0, prevY, W, fac.y - prevY + 2);
    for (let r = 0; r < rows; r++) {
      const z = standZ0 + r * 1.05;
      const y = 1.2 + r * 0.72;
      const top = cam.p(0, y + 0.72, z + 1.05).y;
      if (prevY < -20) break;
      const a = cam.p(left, y, z);
      const b = cam.p(right, y, z);
      ctx.fillStyle = r % 2 ? "#111c38" : "#0e1830";
      ctx.fillRect(a.x, top, b.x - a.x, prevY - top + 0.5);
      crowdRow(ctx, Math.max(-20, a.x), Math.min(W + 20, b.x), top, prevY, r * 13 + 5, r > 2);
      prevY = top;
    }
    // ombre de toit + projecteurs
    const roofG = ctx.createLinearGradient(0, 0, 0, Math.max(40, prevY + 60));
    roofG.addColorStop(0, "rgba(2,6,23,0.95)");
    roofG.addColorStop(1, "rgba(2,6,23,0)");
    ctx.fillStyle = roofG;
    ctx.fillRect(0, 0, W, Math.max(40, prevY + 60));
    for (const fx of [0.08, 0.92]) {
      const lx = W * fx;
      const ly = Math.max(14, cam.hz * 0.12);
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, W * 0.35);
      glow.addColorStop(0, "rgba(255,250,230,0.55)");
      glow.addColorStop(0.15, "rgba(255,240,200,0.18)");
      glow.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fffbe8";
      for (let i = 0; i < 6; i++) ctx.fillRect(lx - 15 + (i % 3) * 11, ly - 4 + Math.floor(i / 3) * 7, 8, 5);
    }

    // écran géant aux couleurs des deux marques
    const standsTop = 64;
    const standsBottom = cam.p(0, 0, boardZ).y - 30;
    const avail = standsBottom - standsTop;
    if (avail > 70) {
      const sh = clamp(avail * 0.62, 60, 170);
      const sw = Math.min(W * 0.86, sh * 2.5);
      const sx = (W - sw) / 2;
      const sy = standsTop + (avail - sh) * 0.38;
      ctx.fillStyle = "#020617";
      ctx.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(sx + sw * 0.45, sy + sh + 6, sw * 0.1, standsBottom - sy - sh);
      const gr = ctx.createLinearGradient(sx, sy, sx, sy + sh);
      gr.addColorStop(0, "#0B47B0");
      gr.addColorStop(1, "#08132B");
      ctx.fillStyle = gr;
      ctx.fillRect(sx, sy, sw, sh);
      const logo = brandImage(LOGO_BL);
      const lh = sh * 0.84;
      if (logo) {
        const lw = (lh * logo.naturalWidth) / logo.naturalHeight;
        ctx.drawImage(logo, sx + sh * 0.1, sy + (sh - lh) / 2, lw, lh);
        const rest = sw - lw - sh * 0.3;
        drawBrandPanel(ctx, sx + lw + sh * 0.2, sy + sh * 0.24, rest, sh * 0.42, "rdc", "rgba(0,0,0,0)");
      } else {
        drawBrandPanel(ctx, sx, sy + sh * 0.3, sw, sh * 0.4, "rdc", "rgba(0,0,0,0)");
      }
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let y = sy; y < sy + sh; y += 3) ctx.fillRect(sx, y, sw, 1);
      if (final) {
        ctx.fillStyle = "#F4C400";
        ctx.font = `${Math.round(sh * 0.15)}px 'Bebas Neue', Anton, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(this.setupData.stage.name.toUpperCase(), sx + sw - 8, sy + sh * 0.2);
        ctx.textAlign = "left";
      }
    }

    // pelouse
    const grassTop = cam.p(0, 0, standZ0).y;
    const gg = ctx.createLinearGradient(0, grassTop, 0, H);
    gg.addColorStop(0, "#14532d");
    gg.addColorStop(1, "#1d7a3e");
    ctx.fillStyle = gg;
    ctx.fillRect(0, grassTop, W, H - grassTop);
    // bandes de tonte
    for (let z = -12; z < standZ0; z += 2.5) {
      if (Math.round(z / 2.5) % 2 === 0) continue;
      const a1 = cam.p(-80, 0, z);
      const a2 = cam.p(80, 0, z);
      const b1 = cam.p(80, 0, z + 2.5);
      const b2 = cam.p(-80, 0, z + 2.5);
      if (a1.z < 0.5) continue;
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.fill();
    }
    // lignes
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineCap = "round";
    const line = (pts: [number, number][]) => {
      ctx.beginPath();
      let first = true;
      for (const [x, z] of pts) {
        const p = cam.p(x, 0, z);
        if (p.z < 0.6) {
          first = true;
          continue;
        }
        ctx.lineWidth = Math.max(1, 0.12 * p.s);
        if (first) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        first = false;
      }
      ctx.stroke();
    };
    const seg = (x0: number, z0: number, x1: number, z1: number, n = 24) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), lerp(z0, z1, i / n)]);
      line(pts);
    };
    seg(-60, D, 60, D, 40);
    seg(-9.16, D, -9.16, D - 5.5, 8);
    seg(9.16, D, 9.16, D - 5.5, 8);
    seg(-9.16, D - 5.5, 9.16, D - 5.5, 20);
    seg(-20.16, D, -20.16, D - 16.5, 12);
    seg(20.16, D, 20.16, D - 16.5, 12);
    seg(-20.16, D - 16.5, 20.16, D - 16.5, 30);
    {
      const arc: [number, number][] = [];
      for (let a = -0.93; a <= 0.93; a += 0.05) arc.push([Math.sin(a) * 9.15, D - 11 - Math.cos(a) * 9.15]);
      line(arc.filter(([, z]) => z < D - 16.5));
      const spot = cam.p(0, 0, D - 11);
      if (spot.z > 0.6 && Math.abs(this.setupData.stage.ballX) > 0.1) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(spot.x, spot.y, 0.13 * spot.s, 0.05 * spot.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // point de tir
    const bs = cam.p(this.setupData.stage.ballX, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(bs.x, bs.y, 0.16 * bs.s, 0.05 * bs.s, 0, 0, Math.PI * 2);
    ctx.fill();

    // panneaux LED derrière le but : les deux marques en alternance
    const segW = 4.6;
    for (let i = -9; i <= 9; i++) {
      const x0 = i * segW - segW / 2;
      const a = cam.p(x0, 0.95, boardZ);
      const b = cam.p(x0 + segW, 0, boardZ);
      if (b.x < -10 || a.x > W + 10) continue;
      // centre : Bloc Léopards + RD Congo Cœur de l'Afrique ; côtés : partenaires, avec rappels des deux marques
      const ai = Math.abs(i);
      if (i === 0 || ai === 4) drawBrandPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, "bl", "#060b1a");
      else if (ai === 2 || ai === 7) drawBrandPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, "rdc", "#060b1a");
      else drawPartnerPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, i < 0 ? -i * 2 : i * 2 - 1);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(a.x, b.y, b.x - a.x + 0.5, Math.max(1, 0.12 * b.s));
    }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    this.bgDirty = false;
  }

  /* ------------------------------------------------------------------ */
  /* Geste tactile                                                      */
  /* ------------------------------------------------------------------ */

  down(x: number, y: number) {
    audio.unlock();
    if (this.phase !== "aim") return;
    this.touch = { pts: [{ x, y, t: performance.now() }] };
    this.fingerTrail = [{ x, y, t: performance.now() }];
    this.cb.onAim?.(true);
  }

  move(x: number, y: number) {
    if (!this.touch) return;
    const now = performance.now();
    this.touch.pts.push({ x, y, t: now });
    this.fingerTrail.push({ x, y, t: now });
  }

  up(x: number, y: number) {
    if (!this.touch) return;
    const now = performance.now();
    this.touch.pts.push({ x, y, t: now });
    const shot = this.readGesture(this.touch.pts);
    this.touch = null;
    this.cb.onAim?.(false);
    if (!shot) return;
    this.pending = shot;
    this.phase = "runup";
    this.phaseT = 0;
    this.cb.onKick();
  }

  cancel() {
    this.touch = null;
    this.cb.onAim?.(false);
  }

  /** Lit le geste : direction → zone visée, vitesse → puissance, courbe → effet. */
  private readGesture(pts: { x: number; y: number; t: number }[], preview = false) {
    if (pts.length < 2) return null;
    const S = pts[0];
    const E = pts[pts.length - 1];
    const dy = S.y - E.y;
    if (dy < this.h * 0.06) return null;
    const cam = this.cam;
    const D = this.D;
    const groundY = cam.p(0, 0, D).y;
    const barY = cam.p(0, GOAL_H, D).y;
    let tx: number;
    let ty: number;
    if (E.y <= groundY) {
      const u = cam.unprojectZ(E.x, E.y, D);
      tx = u.x;
      ty = u.y;
    } else {
      // geste court : on prolonge la direction jusqu'à la cage, tir à ras de terre
      const k = (S.y - (groundY + barY) / 2) / Math.max(1, dy);
      const xAt = S.x + (E.x - S.x) * k;
      tx = cam.unprojectZ(xAt, groundY, D).x;
      const frac = clamp(dy / Math.max(1, S.y - groundY), 0, 1);
      ty = 0.14 + frac * 0.55;
    }
    // vitesse sur les 200 dernières ms
    const tEnd = E.t;
    let i0 = pts.length - 1;
    while (i0 > 0 && tEnd - pts[i0 - 1].t < 200) i0--;
    const A = pts[Math.max(0, i0 - 1)];
    const dt = Math.max(0.035, (tEnd - A.t) / 1000);
    const dist = Math.hypot(E.x - A.x, E.y - A.y) / this.h;
    const speedN = dist / dt;
    const fk = D > 15;
    let v = clamp(12.5 + speedN * (fk ? 4.2 : 5.4), 12.5, fk ? 31 : 35);
    // effet : flèche de la courbe du doigt
    let bulge = 0;
    const lx = E.x - S.x;
    const ly = E.y - S.y;
    const len = Math.hypot(lx, ly) || 1;
    for (const p of pts) {
      const d = ((p.x - S.x) * ly - (p.y - S.y) * lx) / len;
      if (Math.abs(d) > Math.abs(bulge)) bulge = d;
    }
    const T = Math.hypot(D, tx - this.bx) / v;
    // effet franc : un geste courbé fait vraiment tourner le ballon
    const maxAx = (fk ? 4.2 : 2.1) * 8 / (T * T);
    const ax = clamp((bulge / this.h) * 950, -maxAx, maxAx);
    const over = v > (fk ? 27 : 31);
    if (!preview) {
      const n = this.setupData.diff.aimNoise * (0.1 + Math.max(0, v - 27) * 0.045);
      tx += gauss(this.rng) * n;
      ty += gauss(this.rng) * n * 0.8;
      if (over) ty += (v - (fk ? 27 : 31)) * 0.2;
    }
    ty = Math.max(BALL_R, ty);
    const zone = tx < -1.2 ? -1 : tx > 1.2 ? 1 : 0;
    // rotation : latérale pour l'effet, coupée (backspin) pour les tirs piqués, liftée pour les frappes sèches
    const w: V3 = {
      x: v > (fk ? 24 : 28) ? 14 : v < 17 ? -20 : fk ? 6 : 0,
      y: clamp(ax / (CM * v), -170, 170),
      z: 0
    };
    return { tx, ty, v, ax, w, zone, over };
  }

  /** Durée d'affichage du résultat : on laisse le temps de danser le fimbu après un but. */
  private resultDelay() {
    if (!this.outcome) return 99;
    return this.outcome.scored && !this.setupData.reduced ? 3.8 : 1.6;
  }

  /** Touche pendant la célébration : on passe au tir suivant. */
  skip() {
    if (this.phase === "done" && this.outcome && !this.resultSent && this.t - this.resolvedAt > 0.5) {
      this.resolvedAt = this.t - this.resultDelay();
    }
  }

  timeout(): boolean {
    if (this.phase !== "aim") return false;
    this.touch = null;
    this.phase = "done";
    audio.whistle();
    this.finish({ scored: false, base: 0, tags: ["timeout"], label: "Temps écoulé", detail: "Le chrono a sifflé avant ta frappe", zone: 0 });
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Gardien                                                            */
  /* ------------------------------------------------------------------ */

  private planKeeper() {
    const s = this.setupData;
    const K = s.stage.keeper;
    const p = this.pending!;
    const rng = this.rng;
    // point d'arrivée réel au plan du gardien
    const zk = this.D - KEEPER_DZ;
    const arr = flyTo({ x: this.bx, y: this.by, z: this.bz }, { x: this.vx, y: this.vy, z: this.vz }, this.omega, zk);
    const ax = arr.x;
    const ay = arr.y;

    // apprentissage : le gardien connaît ton côté préféré
    const hist = s.history;
    const counts = { "-1": 1, "0": 1, "1": 1 } as Record<string, number>;
    for (const z of hist) counts[String(z)]++;
    const total = counts["-1"] + counts["0"] + counts["1"];
    const habit = counts[String(p.zone)] / total;
    let read = K.read * s.diff.keeperRead;
    if (p.v < 18) read += 0.25;
    if (p.v > 28) read -= 0.12;
    read += K.learn * 0.22 * (habit - 0.34);
    read = clamp(read, 0.03, 0.9);

    let reaction = K.reaction * s.diff.keeperReaction * (0.85 + rng() * 0.3);
    let tx: number;
    let ty: number;
    let kind: DiveSpec["kind"];
    if (rng() < K.stay) {
      kind = Math.abs(ax - this.keeperX) < 0.9 && ay > 1.4 ? "jump" : "stay";
      tx = this.keeperX;
      ty = 1;
      this.keeperRead = Math.abs(ax - this.keeperX) < 1;
    } else if (rng() < read) {
      this.keeperRead = true;
      tx = ax + gauss(rng) * 0.18;
      ty = ay + gauss(rng) * 0.14;
      kind = "mid";
      if (Math.abs(tx - this.keeperX) < 0.8) kind = ty > 1.5 ? "jump" : "stay";
    } else {
      // pari : côté pondéré par les habitudes du tireur
      const wl = Math.pow(counts["-1"], 1 + K.learn);
      const wr = Math.pow(counts["1"], 1 + K.learn);
      const side = rng() * (wl + wr) < wl ? -1 : 1;
      tx = this.keeperX + side * (1.4 + rng() * 1.8);
      ty = 0.3 + rng() * 1.6;
      kind = "mid";
      reaction *= 0.55;
    }
    if (kind === "mid") kind = ty < 0.75 ? "low" : ty < 1.55 ? "mid" : "high";
    const side: 1 | -1 = tx >= this.keeperX ? 1 : -1;
    let px = 0;
    let air = 0;
    if (kind === "low" || kind === "mid" || kind === "high") {
      const base = kind === "low" ? POSES.diveLowR : kind === "mid" ? POSES.diveMidR : POSES.diveHighR;
      const sk = skeleton({ ...base, px: 0, air: 0 }, this.keeperBody);
      const hand = sk.haR;
      const want = Math.abs(tx - this.keeperX);
      px = clamp(want - hand.x - 0.08, 0.1, K.reach * s.diff.keeperReach);
      air = clamp(ty - hand.y, 0, kind === "low" ? 0.15 : 0.95);
    } else if (kind === "stay") {
      px = clamp(tx - this.keeperX, -0.6, 0.6) * side;
    }
    this.dive = { side, kind, px, air, start: reaction, tx, ty, arrive: arr.t };
  }

  private keeperPose(): Pose {
    const t = this.t;
    const base = POSES.keeperReady;
    if (this.phase === "aim" || (this.phase === "runup" && !this.dive)) {
      const sway = Math.sin(t * 1.6) * 0.22;
      const bob = Math.abs(Math.sin(t * 3.2)) * 0.03;
      const p = lerpPose(base, POSES.keeperSet, this.phase === "runup" ? clamp(this.phaseT / 0.3, 0, 1) : 0.15 + 0.15 * Math.sin(t * 3.2));
      if (this.phase === "runup") {
        // pas d'appel (« split step ») juste avant la frappe, bras écartés pour fermer l'angle
        const hop = clamp((this.phaseT - (RUN - 0.24)) / 0.24, 0, 1);
        const air = 0.11 * Math.sin(hop * Math.PI);
        return { ...p, px: sway * (1 - clamp(this.phaseT / 0.35, 0, 1)), air: p.air + air, shL: p.shL - 0.25 * hop, shR: p.shR + 0.25 * hop };
      }
      return { ...p, px: sway, air: p.air + bob };
    }
    const d = this.dive;
    if (!d) return base;
    const since = this.phase === "runup" ? 0 : t - this.kickT - d.start;
    if (since < 0) return POSES.keeperSet;
    const m = (p: Pose) => (d.side === 1 ? p : mirrorPose(p));
    const o = this.outcome;
    if (d.kind === "stay" || d.kind === "jump") {
      const target = d.kind === "jump" ? POSES.keeperJumpUp : POSES.keeperStay;
      const k = easeOutCubic(since / 0.22);
      let p = lerpPose(POSES.keeperSet, target, k);
      if (d.kind === "jump") p = { ...p, air: Math.max(0, 0.5 * Math.sin(clamp(since / 0.6, 0, 1) * Math.PI)) };
      p = { ...p, px: d.px * d.side * k };
      if (o && t - this.resolvedAt > 0.5) {
        const r = easeInOut((t - this.resolvedAt - 0.5) / 0.4);
        p = lerpPose(p, { ...(o.scored ? POSES.keeperSad : POSES.keeperCheer), px: p.px }, r);
      }
      return p;
    }
    const dive = d.kind === "low" ? POSES.diveLowR : d.kind === "mid" ? POSES.diveMidR : POSES.diveHighR;
    const LOAD = 0.09;
    const FLY = 0.36;
    const FALL = 0.32;
    let p: Pose;
    if (since < LOAD) {
      p = lerpPose(POSES.keeperSet, POSES.keeperLoadR, easeOutCubic(since / LOAD));
    } else if (since < LOAD + FLY) {
      const k = (since - LOAD) / FLY;
      p = lerpPose(POSES.keeperLoadR, dive, easeOutCubic(k * 1.25));
      p = { ...p, px: lerp(POSES.keeperLoadR.px, d.px, easeOutCubic(k)), air: d.air * easeOutCubic(Math.min(1, k * 1.3)) };
    } else {
      const k = clamp((since - LOAD - FLY) / FALL, 0, 1);
      const fallP: Pose = { ...dive, px: d.px, air: d.air };
      p = lerpPose(fallP, { ...POSES.lieR, px: d.px + 0.25 }, easeInOut(k));
      p = { ...p, air: d.air * (1 - easeInOut(k)) };
      if (o && !o.scored && t - this.resolvedAt > 1.1) {
        const r = easeInOut((t - this.resolvedAt - 1.1) / 0.5);
        p = lerpPose(p, { ...POSES.keeperCheer, px: d.px + 0.25 }, r);
      }
    }
    return m(p);
  }

  /* ------------------------------------------------------------------ */
  /* Boucle                                                             */
  /* ------------------------------------------------------------------ */

  private lastDt = 0;
  private curve: { x: number; y: number; z: number }[] = [];

  update(dt: number) {
    if (!this.setupData) return;
    dt = Math.min(dt, 1 / 30);
    this.lastDt = dt;
    this.t += dt;
    this.phaseT += dt;
    const s = this.setupData;

    if (this.phase === "runup" && this.phaseT >= RUN) {
      this.launch();
    }
    if (this.use3d) this.drive3D();

    // la physique continue après le résultat : le ballon retombe dans le filet, rebondit, roule
    if (this.phase === "flight" || (this.phase === "done" && this.kickT > 0 && this.pending)) {
      const steps = 6;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) this.step(h);
      this.spin += dt * (Math.hypot(this.vx, this.vz) * 0.5 + this.omega.y * 0.12);
      if (!this.outcome || this.t - this.resolvedAt < 0.15) {
        this.curve.push({ x: this.bx, y: this.by, z: this.bz });
        if (this.curve.length > 90) this.curve.shift();
      }
      if (!s.reduced) {
        this.trail.push({ x: this.bx, y: this.by, r: this.bz });
        if (this.trail.length > 7) this.trail.shift();
      }
      if (!s.reduced && !this.outcome) this.zoom = lerp(this.zoom, 1.1, dt * 3);
    }
    if (this.phase === "done" && this.outcome && !this.resultSent && this.t - this.resolvedAt > this.resultDelay()) {
      this.resultSent = true;
      this.cb.onResult(this.outcome);
    }
    if (this.outcome && !s.reduced) {
      const celebrating = this.outcome.scored && this.t - this.resolvedAt > 0.6;
      this.zoom = lerp(this.zoom, celebrating ? 1 : 1.06, dt * 2);
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    updateParticles(this.parts, dt);
    this.keeperSk = skeleton(this.keeperPose(), this.keeperBody);
    const now = performance.now();
    this.fingerTrail = this.fingerTrail.filter((p) => now - p.t < 260);
  }

  private launch() {
    const p = this.pending!;
    const D = this.D;
    this.ax = p.ax;
    this.omega = { ...p.w };
    const v0 = solveShot({ x: this.bx, y: BALL_R, z: 0 }, p.tx, p.ty, D, p.v, this.omega);
    this.vx = v0.x;
    this.vy = v0.y;
    this.vz = v0.z;
    this.kickT = this.t;
    this.phase = "flight";
    this.phaseT = 0;
    this.planKeeper();
    audio.kick(clamp(p.v / 30, 0.3, 1));
    if (!this.setupData.reduced) {
      const b = this.cam.p(this.bx, 0, this.bz);
      dustBurst(this.parts, b.x, b.y, 10, "#3f8f4f", b.s / 120);
    }
  }

  private wallTop(): number {
    const since = this.t - this.kickT;
    const jump = 0.36 * Math.max(0, Math.sin(clamp((since - 0.1) / 0.55, 0, 1) * Math.PI));
    return 1.86 + jump;
  }

  private step(dt: number) {
    const D = this.D;
    if (this.ballHeld) return;
    const pz = this.bz;
    const a = ballAccel({ x: this.vx, y: this.vy, z: this.vz }, this.omega);
    this.vx += a.x * dt;
    this.vy += a.y * dt;
    this.vz += a.z * dt;
    const decay = 1 - SPIN_DECAY * dt;
    this.omega.x *= decay;
    this.omega.y *= decay;
    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    this.bz += this.vz * dt;

    // sol
    if (this.by < BALL_R) {
      this.by = BALL_R;
      if (this.vy < -1.2) audio.bounce(Math.min(1, -this.vy / 8));
      this.vy = -this.vy * 0.52;
      this.vx *= 0.85;
      this.vz *= 0.82;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }
    // frottement de roulement sur la pelouse
    if (this.by <= BALL_R + 0.002 && this.vy === 0) {
      const f = Math.max(0, 1 - 1.6 * dt);
      this.vx *= f;
      this.vz *= f;
    }

    // mur
    const wz = this.wallZ();
    if (this.setupData.stage.wall && !this.crossedWall && pz < wz && this.bz >= wz) {
      this.crossedWall = true;
      const top = this.wallTop();
      for (const x of this.wallXs()) {
        if (Math.abs(this.bx - x) < 0.25 + BALL_R && this.by - BALL_R < top) {
          this.vz = -Math.abs(this.vz) * 0.25;
          this.vx = (this.bx - x) * 8 + (this.rng() - 0.5) * 3;
          this.vy = 2 + this.rng() * 2;
          this.omega = { x: 0, y: 0, z: 0 };
          audio.glove();
          this.resolve({ scored: false, base: 0, tags: ["wall"], label: "Contré !", detail: "Le mur a fait son travail", zone: this.pending!.zone });
          break;
        }
      }
    }

    // gardien (3D : collision continue avec les vrais os ; 2D : au passage du plan)
    const kz = D - KEEPER_DZ;
    const use3 = this.use3d;
    const cross = use3 ? !this.outcome && this.bz > D - 2.2 && this.bz < D + 0.2 : !this.crossedKeeper && !this.outcome && pz < kz && this.bz >= kz;
    if (cross) {
      if (!use3) this.crossedKeeper = true;
      const sk = skeleton(this.keeperPose(), this.keeperBody);
      const hit = use3 ? this.keeperHit3D() : keeperHit(sk, this.bx - this.keeperX, this.by);
      if (hit) {
        const speed = Math.hypot(this.vx, this.vy, this.vz);
        const catchIt = hit === "glove" && speed < 22 && this.by > 0.4 && this.by < 1.9 && this.dive?.kind !== "high";
        audio.glove();
        if (catchIt) {
          this.ballHeld = true;
        } else {
          const kcx = use3 && this.A.keeper ? this.A.keeper.bone(this.c3m!.BONE.pelvis).x : this.keeperX + sk.pelvis.x;
          const away = Math.sign(this.bx - kcx) || 1;
          this.vz = -Math.abs(this.vz) * 0.18;
          this.vx = away * (3 + this.rng() * 4);
          this.vy = 2.5 + this.rng() * 3;
          this.omega = { x: 0, y: 0, z: 0 };
        }
        const read = this.keeperRead;
        const learnt = this.setupData.stage.keeper.learn > 0.5 && this.setupData.history.filter((z) => z === this.pending!.zone).length >= 2;
        this.resolve({
          scored: false,
          base: 0,
          tags: ["save", catchIt ? "catch" : "parry"],
          label: catchIt ? "Capté !" : "Arrêt !",
          detail: learnt ? "Il connaît ton côté préféré : varie !" : read ? "Le gardien a lu ta frappe" : "Bien placé, il a tout vu",
          zone: this.pending!.zone
        });
        if (!this.setupData.reduced) this.shake = 0.4;
      }
    }

    // ligne de but
    if (!this.crossedGoal && pz < D && this.bz >= D) {
      this.crossedGoal = true;
      if (this.outcome) return;
      const x = this.bx;
      const y = this.by;
      const ax = Math.abs(x);
      const p = this.pending!;
      const postHit = Math.abs(ax - GOAL_W) < BALL_R + 0.06 && y < GOAL_H + 0.06;
      const barHit = Math.abs(y - GOAL_H) < BALL_R + 0.06 && ax < GOAL_W + 0.06;
      if (postHit || barHit) {
        audio.post();
        if (!this.setupData.reduced) this.shake = 0.7;
        const inside = postHit ? ax < GOAL_W - 0.02 && this.rng() < 0.45 : y < GOAL_H - 0.03 && this.rng() < 0.4;
        if (inside) {
          this.vx *= -0.4;
          this.vz *= 0.7;
          this.goal(p, ["post-in"], "Poteau rentrant !");
        } else {
          this.vz = -Math.abs(this.vz) * 0.4;
          if (postHit) this.vx = Math.sign(x) * 3;
          else this.vy = Math.abs(this.vy) * 0.5 + 1;
          this.resolve({ scored: false, base: 0, tags: ["post"], label: postHit ? "Poteau !" : "Transversale !", detail: "À quelques centimètres…", zone: p.zone });
        }
        return;
      }
      if (ax < GOAL_W - BALL_R && y < GOAL_H - BALL_R) {
        this.goal(p, [], "But !");
      } else {
        const high = y >= GOAL_H;
        this.resolve({
          scored: false,
          base: 0,
          tags: ["miss"],
          label: high ? "Au-dessus" : "À côté",
          detail: p.over ? "Frappe trop appuyée : glisse moins vite" : high ? "Vise un peu plus bas" : "Garde le ballon dans le cadre",
          zone: p.zone
        });
        audio.crowd("groan");
      }
    }

    // filets
    if (this.inNet) {
      const back = D + 2 - this.by * 0.42 - BALL_R;
      if (this.bz > back) {
        this.bz = back;
        if (this.vz > 0) {
          // le filet absorbe le choc puis renvoie légèrement le ballon
          this.vz = -this.vz * 0.12;
          this.vx *= 0.45;
          this.vy *= 0.55;
          this.omega = { x: this.omega.x * 0.3, y: this.omega.y * 0.3, z: 0 };
        }
      }
      if (Math.abs(this.bx) > GOAL_W - BALL_R) {
        this.bx = Math.sign(this.bx) * (GOAL_W - BALL_R);
        this.vx *= -0.2;
      }
      if (this.by > GOAL_H - BALL_R) {
        this.by = GOAL_H - BALL_R;
        this.vy = -Math.abs(this.vy) * 0.2;
      }
    }
    // hors champ
    if (this.bz > D + 4 && !this.inNet) {
      this.bz = D + 4;
      this.vz = -this.vz * 0.2;
      this.vx *= 0.5;
    }
  }

  private goal(p: NonNullable<FootEngine["pending"]>, extra: string[], label: string) {
    this.inNet = true;
    const tags = [...extra];
    let base = this.D > 15 ? 150 : 100;
    const x = Math.abs(this.bx);
    const y = this.by;
    let detail = "";
    if (y > 1.7 && x > 2.4) {
      tags.push("lucarne");
      base += 50;
      detail = "Lucarne !";
    } else if (y < 0.5 && x > 2.6) {
      tags.push("petit-filet");
      base += 25;
      detail = "Petit filet";
    }
    if (Math.abs(p.ax) > 6) {
      tags.push("effet");
      base += 25;
      detail = detail ? `${detail} · enroulée` : "Frappe enroulée";
    }
    const d = this.dive;
    if (d && d.kind !== "stay" && d.kind !== "jump" && x < 1 && p.v < 17.5) {
      tags.push("panenka");
      base += 75;
      detail = "Panenka !";
    }
    if (extra.includes("post-in")) base += 25;
    if (!detail) {
      detail = d && d.kind !== "stay" && Math.sign(this.bx - this.keeperX) !== d.side ? "Gardien pris à contre-pied" : "Imparable";
    }
    if (this.D > 15) tags.push("coup-franc");
    audio.net();
    audio.crowd("goal");
    if (!this.setupData.reduced) {
      const c = this.cam.p(this.bx, this.by, this.D);
      confettiBurst(this.parts, this.w / 2, this.h * 0.25, 70, Math.max(this.w, this.h) * 0.5);
      dustBurst(this.parts, c.x, c.y, 8, "#ffffff", 0.6);
    }
    this.resolve({ scored: true, base, tags, label, detail, zone: p.zone });
  }

  private resolve(o: ShotOutcome) {
    if (this.outcome) return;
    this.outcome = o;
    this.resolvedAt = this.t;
    this.phase = "done";
    if (!o.scored && o.tags.includes("save")) audio.crowd("ooh");
  }

  private finish(o: ShotOutcome) {
    this.outcome = o;
    this.resolvedAt = this.t - 0.6;
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                              */
  /* ------------------------------------------------------------------ */

  render() {
    if (!this.setupData || !this.w) return;
    if (this.bgDirty || !this.bg) this.renderBackground();
    const ctx = this.ctx;
    const cam = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    // zoom vers la cage pendant le tir (désactivé en mouvement réduit)
    const gc = cam.p(0, 1.1, this.D);
    this.viewOff = { x: 0, y: 0 };
    if (this.zoom !== 1 || this.shake > 0) {
      const sx = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake : 0;
      const sy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
      this.viewOff = { x: sx, y: sy };
      ctx.translate(gc.x + sx, gc.y + sy);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-gc.x, -gc.y);
    }
    ctx.drawImage(this.bg!, 0, 0, this.w, this.h);

    const D = this.D;
    const ballInside = this.bz > D;
    if (!this.use3d) {
      this.drawNet(ctx, true);
      if (ballInside) this.drawBall(ctx);
      this.drawNet(ctx, false);
      this.drawPosts(ctx);
    }

    if (this.use3d) {
      this.drawCurveTrail(ctx);
      drawParticles(ctx, this.parts);
      ctx.restore();
      if (this.phase === "aim") this.drawAimAssist(ctx);
      this.drawFingerTrail(ctx);
      this.c3!.sync(this.cam, this.w, this.h, { zoom: this.zoom, gx: gc.x, gy: gc.y, ox: this.viewOff.x, oy: this.viewOff.y });
      const held = this.ballHeld && this.A.keeper;
      if (held) {
        const B = this.c3m!.BONE;
        const l = this.A.keeper!.bone(B.lHand);
        const r = this.A.keeper!.bone(B.rHand);
        this.c3!.setBall((l.x + r.x) / 2, (l.y + r.y) / 2, (l.z + r.z) / 2 - 0.08);
      } else {
        const moving = this.phase === "flight" || this.phase === "done";
        this.c3!.setBall(this.bx, this.by, this.bz, moving ? this.omega : undefined, moving ? { x: this.vx, y: this.vy, z: this.vz } : undefined, this.lastDt);
      }
      this.c3!.updateNet(this.bx, this.by, this.bz, this.inNet, this.t);
      this.c3!.render();
      return;
    }

    // entités triées par profondeur
    const ents: { z: number; draw: () => void }[] = [];
    ents.push({ z: D - KEEPER_DZ, draw: () => this.drawKeeper(ctx) });
    if (!ballInside) ents.push({ z: this.bz + 0.01, draw: () => this.drawBall(ctx) });
    const wz = this.wallZ();
    this.wallXs().forEach((x, i) => ents.push({ z: wz, draw: () => this.drawWallPlayer(ctx, x, i) }));
    ents.push({ z: this.shooterZ(), draw: () => this.drawShooter(ctx) });
    for (const m of this.teammates()) {
      ents.push({
        z: m.z,
        draw: () => {
          const g = this.cam.p(m.x, 0, m.z);
          drawFigure(ctx, skeleton(m.pose, m.body), m.body, m.kit, { sx: g.x, sy: g.y, s: g.s }, { facing: "front" });
        }
      });
    }
    ents.sort((a, b) => b.z - a.z).forEach((e) => e.draw());

    drawParticles(ctx, this.parts);
    ctx.restore();

    if (this.phase === "aim") this.drawAimAssist(ctx);
    this.drawFingerTrail(ctx);
  }

  private drawNet(ctx: CanvasRenderingContext2D, backLayer: boolean) {
    const cam = this.cam;
    const D = this.D;
    const depthAt = (y: number) => 2 - y * 0.42;
    const bulge = (x: number, y: number, z: number) => {
      if (!this.inNet) return z;
      const d = Math.hypot(x - this.bx, y - this.by);
      if (d > 0.9) return z;
      return Math.max(z, this.bz + BALL_R * (1 - d / 0.9) * 2.5);
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = backLayer ? "rgba(226,232,240,0.28)" : "rgba(226,232,240,0.42)";
    const P = (x: number, y: number, z: number) => cam.p(x, y, z);
    if (backLayer) {
      ctx.beginPath();
      // filet du fond : verticales et horizontales
      for (let x = -GOAL_W; x <= GOAL_W + 0.01; x += 0.3) {
        for (let y = 0; y <= GOAL_H; y += 0.15) {
          const z = bulge(x, y, D + depthAt(y));
          const p = P(x, y, z);
          if (y === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      for (let y = 0; y <= GOAL_H + 0.01; y += 0.25) {
        for (let x = -GOAL_W; x <= GOAL_W + 0.01; x += 0.15) {
          const z = bulge(x, y, D + depthAt(y));
          const p = P(x, y, z);
          if (x === -GOAL_W) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      // ombre du fond
      const a = P(-GOAL_W, GOAL_H, D + depthAt(GOAL_H));
      const b = P(GOAL_W, 0, D + depthAt(0));
      ctx.fillStyle = "rgba(2,6,23,0.18)";
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
      // filets latéraux + toit
      ctx.beginPath();
      for (const sx of [-GOAL_W, GOAL_W]) {
        for (let k = 0; k <= 1.001; k += 0.2) {
          for (let y = 0; y <= GOAL_H + 0.01; y += 0.3) {
            const p = P(sx, y, D + depthAt(y) * k);
            if (y === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
      }
      for (let x = -GOAL_W; x <= GOAL_W + 0.01; x += 0.45) {
        const a = P(x, GOAL_H, D);
        const b = P(x, GOAL_H, D + depthAt(GOAL_H));
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      // barres arrière
      ctx.strokeStyle = "rgba(226,232,240,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const sx of [-GOAL_W, GOAL_W]) {
        const a = P(sx, GOAL_H, D + depthAt(GOAL_H));
        const b = P(sx, 0, D + depthAt(0));
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      const c = P(-GOAL_W, 0, D + 2);
      const d = P(GOAL_W, 0, D + 2);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
  }

  private drawPosts(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const D = this.D;
    const a = cam.p(-GOAL_W, 0, D);
    const b = cam.p(-GOAL_W, GOAL_H, D);
    const c = cam.p(GOAL_W, GOAL_H, D);
    const d = cam.p(GOAL_W, 0, D);
    const w = 0.12 * a.s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x + w * 0.4, a.y);
    ctx.lineTo(b.x + w * 0.4, b.y + w * 0.4);
    ctx.lineTo(c.x + w * 0.4, c.y + w * 0.4);
    ctx.lineTo(d.x + w * 0.4, d.y);
    ctx.stroke();
    ctx.strokeStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(148,163,184,0.6)";
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.beginPath();
    ctx.moveTo(a.x + w * 0.25, a.y);
    ctx.lineTo(b.x + w * 0.25, b.y + w * 0.3);
    ctx.lineTo(c.x - w * 0.25, c.y + w * 0.3);
    ctx.lineTo(d.x - w * 0.25, d.y);
    ctx.stroke();
  }

  private drawKeeper(ctx: CanvasRenderingContext2D) {
    const sk = this.keeperSk || skeleton(this.keeperPose(), this.keeperBody);
    const g = this.cam.p(this.keeperX, 0, this.D - KEEPER_DZ);
    drawFigure(ctx, sk, this.keeperBody, this.keeperKit, { sx: g.x, sy: g.y, s: g.s }, { facing: "front" });
    if (this.ballHeld) {
      const hx = (sk.haL.x + sk.haR.x) / 2 + this.keeperX;
      const hy = (sk.haL.y + sk.haR.y) / 2 + 0.06;
      const p = this.cam.p(hx, hy, this.D - KEEPER_DZ - 0.15);
      drawFootball(ctx, p.x, p.y, BALL_R * p.s, this.spin);
      // gants par-dessus le ballon
      ctx.fillStyle = this.keeperKit.gloves!;
      ctx.beginPath();
      ctx.arc(p.x - BALL_R * p.s * 0.8, p.y, BALL_R * p.s * 0.55, 0, Math.PI * 2);
      ctx.arc(p.x + BALL_R * p.s * 0.8, p.y, BALL_R * p.s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawWallPlayer(ctx: CanvasRenderingContext2D, x: number, i: number) {
    const since = this.phase === "flight" || this.phase === "done" ? this.t - this.kickT : -1;
    const k = since < 0.1 ? 0 : Math.sin(clamp((since - 0.1) / 0.55, 0, 1) * Math.PI);
    const p = lerpPose(POSES.wall, POSES.wallJump, k);
    const body = this.wallBodies[i];
    const sk = skeleton({ ...p, air: 0.36 * k }, body);
    const g = this.cam.p(x, 0, this.wallZ());
    drawFigure(ctx, sk, body, { ...RIVAL_KIT, number: String(4 + i * 3) }, { sx: g.x, sy: g.y, s: g.s }, { facing: "front" });
  }

  /** Position et pose du tireur : élan réel (foulées calées sur la distance), appui, frappe, célébration. */
  private shooterState(): { x: number; z: number; pose: Pose; facing: "front" | "back" } {
    const bx = this.setupData.stage.ballX;
    const S0 = { x: bx - 1.3, z: -2.35 };
    const P = { x: bx - 0.3, z: -0.22 };
    const len = Math.hypot(P.x - S0.x, P.z - S0.z);
    const STRIDE = 2.1;
    const travel = (k: number) => 1 - Math.pow(1 - clamp(k, 0, 1), 1.5);
    const posAt = (k: number) => ({ x: lerp(S0.x, P.x, travel(k)), z: lerp(S0.z, P.z, travel(k)) });
    const KB = 0.7;
    const phaseAt = (k: number) => Math.PI / 2 + ((travel(k) - travel(KB)) * len * 2 * Math.PI) / STRIDE;

    if (this.phase === "aim") {
      const breath = Math.sin(this.t * 2.2);
      let sg = { ...KICK.idle, la: KICK.idle.la + breath * 0.04, ra: KICK.idle.ra - breath * 0.04, lean: KICK.idle.lean + breath * 0.015 };
      if (this.touch) sg = lerpSag(sg, KICK.ready, 0.7);
      return { ...S0, facing: "back", pose: sagPose(sg) };
    }
    if (this.phase === "runup") {
      const k = this.phaseT / RUN;
      const pos = posAt(k);
      let sg: Sag;
      if (k < KB) {
        sg = runSag(phaseAt(k), lerp(0.55, 1, clamp(k / 0.25, 0, 1)));
      } else if (k < 0.88) {
        sg = lerpSag(runSag(phaseAt(KB), 1), KICK.plant, easeOutCubic((k - KB) / (0.88 - KB)));
      } else {
        const e = (k - 0.88) / 0.12;
        sg = lerpSag(KICK.plant, KICK.strike, e * e * e);
      }
      return { ...pos, facing: "back", pose: sagPose(sg) };
    }
    // après le contact
    const since = this.t - this.kickT;
    let sg: Sag;
    if (since < 0.22) sg = lerpSag(KICK.strike, KICK.follow, easeOutCubic(since / 0.22));
    else if (since < 0.55) sg = lerpSag(KICK.follow, KICK.land, easeInOut((since - 0.22) / 0.33));
    else sg = KICK.land;
    let pos = { ...P };
    const o = this.outcome;
    if (o && this.t - this.resolvedAt > 0.3) {
      const c = this.t - this.resolvedAt - 0.3;
      if (o.scored) {
        if (this.setupData.reduced) return { ...pos, facing: "front", pose: POSES.shooterCheer };
        const CEL = this.celebrationSpot();
        const kind = this.celebrationKind();
        const toCam = (dur: number) => {
          const k = clamp(c / dur, 0, 1);
          return { x: lerp(P.x, CEL.x, easeInOut(k)), z: lerp(P.z, CEL.z, easeInOut(k)) };
        };
        const runFront = () => sagPose({ ...runSag((c * 3.6 / STRIDE) * 2 * Math.PI, 0.9), lean: 0.2 }, "front");
        if (kind === "fimbu") {
          // fin de série : demi-tour, sprint vers la caméra, puis fimbu avec les coéquipiers
          if (c < 0.7) return { ...toCam(0.7), facing: "front", pose: runFront() };
          const into = clamp((c - 0.7) / 0.25, 0, 1);
          return { ...CEL, facing: "front", pose: lerpPose(sagPose(runSag(0, 0.3), "front"), fimbuPose(c - 0.7), into) };
        }
        if (kind === "glissade") {
          // sprint puis glissade à genoux, bras ouverts vers la tribune
          if (c < 0.55) return { ...toCam(0.9), facing: "front", pose: runFront() };
          const k = clamp((c - 0.55) / 0.5, 0, 1);
          const slide = easeOutCubic(k);
          const base = toCam(0.9);
          const extra = slide * 0.9;
          return {
            x: base.x, z: base.z - extra, facing: "front",
            pose: lerpPose(runFront(), POSES.kneeSlide, easeOutCubic(clamp(k * 2, 0, 1)))
          };
        }
        if (kind === "nom") {
          // dos à la caméra, les pouces vers le nom sur le maillot
          const k = easeInOut(clamp(c / 0.35, 0, 1));
          const bob = Math.abs(Math.sin(c * 5)) * 0.04 * k;
          return { ...pos, facing: "back", pose: { ...lerpPose(sagPose(sg), POSES.thumbsName, k), air: bob } };
        }
        if (kind === "poing") {
          // face caméra, sauts poing levé
          if (c < 0.5) return { ...toCam(0.5), facing: "front", pose: runFront() };
          const j = c - 0.5;
          return { ...CEL, facing: "front", pose: { ...POSES.fistPump, air: Math.max(0, Math.sin(j * 6.5)) * 0.32 } };
        }
        // « avion » : course vers le poteau de corner, bras écartés
        const speed = 3.2;
        const dist = c * speed;
        const run = runSag((dist / STRIDE) * 2 * Math.PI, 0.9, 1);
        const ramp = clamp(c / 0.35, 0, 1);
        return {
          x: P.x + dist * 0.72, z: P.z + dist * 0.7, facing: "back",
          pose: sagPose(lerpSag(sg, { ...run, lean: 0.12, roll: 0.18 * Math.sin(c * 2) }, ramp))
        };
      }
      const r = easeInOut(c / 0.45);
      return { ...pos, facing: "back", pose: lerpPose(sagPose(sg), POSES.shooterSad, r) };
    }
    return { ...pos, facing: "back", pose: sagPose(sg) };
  }

  /** Célébration variée à chaque but ; le fimbu est réservé au dernier but de la série. */
  private celebrationKind(): "fimbu" | "glissade" | "nom" | "poing" | "avion" {
    if (this.setupData.finale) return "fimbu";
    const list = ["avion", "glissade", "nom", "poing"] as const;
    return list[(this.setupData.shot + (this.setupData.seed % 4)) % list.length];
  }

  private celebrationSpot() {
    const bx = this.setupData.stage.ballX;
    return { x: bx + 0.2, z: -1.6 };
  }

  /** Deux coéquipiers accourent pour danser le fimbu avec le buteur. */
  private teammates(): { x: number; z: number; pose: Pose; kit: Kit; body: Body }[] {
    const o = this.outcome;
    if (!o || !o.scored || this.setupData.reduced || !this.setupData.finale) return [];
    const c = this.t - this.resolvedAt - 0.5;
    if (c < 0) return [];
    const CEL = this.celebrationSpot();
    const mates = [
      { from: -5.5, dx: -1.25, dz: 0.35, num: 4, boots: "#22d3ee", body: BODIES[2] },
      { from: 5.5, dx: 1.25, dz: 0.5, num: 8, boots: "#f472b6", body: BODIES[3] }
    ];
    return mates.map((m) => {
      const k = clamp(c / 0.9, 0, 1);
      const x = lerp(CEL.x + m.from, CEL.x + m.dx, easeOutCubic(k));
      const z = CEL.z + m.dz;
      const pose =
        k < 1
          ? sagPose({ ...runSag((c * 4.2 / 2.1) * 2 * Math.PI, 0.95), lean: 0.2 }, "front")
          : fimbuPose(c - 0.9 + 0.2);
      return { x, z, pose, kit: LEOPARDS_KIT("", m.num, m.boots), body: m.body };
    });
  }

  private shooterZ() {
    return this.shooterState().z;
  }

  private drawShooter(ctx: CanvasRenderingContext2D) {
    const st = this.shooterState();
    const sk = skeleton(st.pose, this.shooterBody);
    const g = this.cam.p(st.x, 0, st.z);
    drawFigure(ctx, sk, this.shooterBody, this.shooterKit, { sx: g.x, sy: g.y, s: g.s }, { facing: st.facing });
  }

  private drawBall(ctx: CanvasRenderingContext2D) {
    if (this.ballHeld) return;
    const cam = this.cam;
    // ombre
    const sh = cam.p(this.bx, 0, this.bz);
    const hgt = this.by - BALL_R;
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.4 - hgt * 0.08, 0.06, 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, BALL_R * sh.s * (1 + hgt * 0.15), BALL_R * sh.s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // traînée
    if (this.phase === "flight") {
      this.trail.forEach((t, i) => {
        const p = cam.p(t.x, t.y, t.r);
        ctx.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.18})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL_R * p.s * 0.9, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    const p = cam.p(this.bx, this.by, this.bz);
    drawFootball(ctx, p.x, p.y, Math.max(2, BALL_R * p.s), this.spin);
  }

  private drawAimAssist(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const D = this.D;
    // anneau d'invitation autour du ballon
    const b = cam.p(this.bx, BALL_R, this.bz);
    if (!this.touch) {
      const pulse = this.setupData.reduced ? 0.5 : (Math.sin(this.t * 4) + 1) / 2;
      ctx.strokeStyle = `rgba(244,196,0,${0.45 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + BALL_R * b.s * 0.6, BALL_R * b.s * (2.2 + pulse * 0.5), BALL_R * b.s * (0.9 + pulse * 0.2), 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (!this.setupData.diff.assist || this.touch.pts.length < 3) return;
    const shot = this.readGesture(this.touch.pts, true);
    if (!shot) return;
    const t = cam.p(shot.tx, shot.ty, D);
    // trajectoire fantôme
    const p0 = { x: this.bx, y: BALL_R, z: this.bz };
    const v0 = solveShot(p0, shot.tx, shot.ty, D, shot.v, shot.w);
    const pts: V3[] = [];
    flyTo(p0, v0, shot.w, D, pts);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((q, i) => {
      const p = cam.p(q.x, q.y, q.z);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const inFrame = Math.abs(shot.tx) < GOAL_W && shot.ty < GOAL_H;
    ctx.strokeStyle = inFrame ? "#F4C400" : "#ef4444";
    ctx.lineWidth = 2.5;
    const r = 0.3 * t.s;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.moveTo(t.x - r * 1.5, t.y);
    ctx.lineTo(t.x - r * 0.5, t.y);
    ctx.moveTo(t.x + r * 0.5, t.y);
    ctx.lineTo(t.x + r * 1.5, t.y);
    ctx.stroke();
  }


  /* ------------------------------------------------------------------ */
  /* Pilotage des personnages 3D                                        */
  /* ------------------------------------------------------------------ */

  private drive3D() {
    const A = this.A;
    const m = this.c3m!;
    const c3 = this.c3!;
    const B = m.BONE;
    const s = this.setupData;
    const sh = A.shooter!;
    const kp = A.keeper!;
    const D = this.D;
    const tc = c3.kickContact;
    const foot = c3.kickFoot;
    const rootX = s.stage.ballX - foot.x - 0.05;
    const rootZ = -foot.z - 0.14;
    const END = Math.min(1.34, c3.clips.kick!.duration - 0.15);

    /* --- tireur --- */
    sh.motionScale = { x: 1, y: 0, z: 1, lift: 0 };
    sh.inPlace = false;
    const tAim = D > 15 ? 0.22 : 0.02;
    if (this.phase === "aim") {
      sh.place(rootX, rootZ, 0);
      sh.pose("kick", tAim);
    } else if (this.phase === "runup") {
      sh.place(rootX, rootZ, 0);
      sh.pose("kick", tAim + ((tc - tAim) * this.phaseT) / RUN);
    } else {
      const since = this.t - this.kickT;
      const o = this.outcome;
      const c = o ? this.t - this.resolvedAt - 0.3 : -1;
      const kt = Math.min(END, tc + since);
      if (!o || c < 0) {
        sh.place(rootX, rootZ, 0);
        sh.pose("kick", kt);
      } else {
        if (!this.celeb.captured) {
          sh.place(rootX, rootZ, 0);
          sh.pose("kick", kt);
          sh.root.updateMatrixWorld(true);
          const hp = sh.bone(B.pelvis);
          this.celeb = { x: hp.x, z: Math.min(hp.z, -0.6), captured: true };
        }
        this.celebrate3D(sh, c, o.scored, END);
      }
    }

    /* --- gardien --- */
    const kx = this.keeperX;
    const kz = D - KEEPER_DZ;
    const d = this.dive;
    kp.motionScale = { x: 1, y: 0, z: 1, lift: 0 };
    if (this.phase === "aim" || this.phase === "runup" || !d) {
      const sway = Math.sin(this.t * 1.6) * 0.22 * (this.phase === "runup" ? 1 - clamp(this.phaseT / 0.35, 0, 1) : 1);
      const hop = this.phase === "runup" ? 0.1 * Math.sin(clamp((this.phaseT - (RUN - 0.24)) / 0.24, 0, 1) * Math.PI) : 0;
      kp.inPlace = true;
      kp.place(kx + sway, kz, Math.PI, false, hop);
      kp.pose("catch", 0.02);
      // posture de gardien : fléchi, sur les appuis, bras ouverts paumes vers le tireur
      {
        const V = this.c3m!.THREE.Vector3;
        const bounce = Math.abs(Math.sin(this.t * 4.2)) * (this.setupData.reduced ? 0 : 1);
        kp.dropHips(0.13 + bounce * 0.03);
        kp.aim(B.lThigh, B.lCalf, new V(0.32, -0.85, 0.4));
        kp.aim(B.rThigh, B.rCalf, new V(-0.32, -0.85, 0.4));
        kp.aim(B.lCalf, B.lFoot, new V(0.08, -1, -0.12));
        kp.aim(B.rCalf, B.rFoot, new V(-0.08, -1, -0.12));
        kp.aim(B.lUpper, B.lFore, new V(0.75, -0.55, 0.45));
        kp.aim(B.rUpper, B.rFore, new V(-0.75, -0.55, 0.45));
        kp.aim(B.lFore, B.lHand, new V(0.3, 0.15, 1));
        kp.aim(B.rFore, B.rHand, new V(-0.3, 0.15, 1));
      }
      // bras écartés pendant l'élan : fermer l'angle
      if (this.phase === "runup") {
        const w = clamp(this.phaseT / 0.3, 0, 1) * 0.7;
        kp.aim(B.lUpper, B.lFore, new this.c3m!.THREE.Vector3(0.9, -0.55, 0.35), w);
        kp.aim(B.rUpper, B.rFore, new this.c3m!.THREE.Vector3(-0.9, -0.55, 0.35), w);
      }
    } else {
      // tirs longs (coups francs) : il ne plonge pas trop tôt, il se replace en pas chassés puis part au bon moment
      const M0 = c3.diveMeta;
      const isDive = d.kind === "low" || d.kind === "mid" || d.kind === "high";
      const natural = (M0.te - 0.32) / 1.9;
      const startEff = isDive ? Math.max(d.start, d.arrive - natural - 0.03) : d.start;
      const waitT = this.t - this.kickT - d.start;
      const shuffle = isDive && startEff > d.start ? clamp(d.tx - kx, -0.8, 0.8) * clamp(waitT / Math.max(0.2, startEff - d.start), 0, 1) * 0.75 : 0;
      const kx2 = kx + shuffle;
      const since = this.t - this.kickT - startEff;
      if (since < 0) {
        kp.inPlace = true;
        kp.place(kx2, kz, Math.PI, false, waitT > 0 ? Math.abs(Math.sin(waitT * 9)) * 0.05 : 0);
        kp.pose("catch", 0.02);
        if (waitT > 0) {
          const V = this.c3m!.THREE.Vector3;
          kp.dropHips(0.12);
          kp.aim(B.lThigh, B.lCalf, new V(0.32, -0.85, 0.4));
          kp.aim(B.rThigh, B.rCalf, new V(-0.32, -0.85, 0.4));
          kp.aim(B.lUpper, B.lFore, new V(0.75, -0.5, 0.45));
          kp.aim(B.rUpper, B.rFore, new V(-0.75, -0.5, 0.45));
        }
      } else if (isDive) {
        // plongeon calé sur l'arrivée du ballon : les gants atteignent le point visé au bon moment
        const M = c3.diveMeta;
        const K = s.stage.keeper;
        const avail = Math.max(0.16, d.arrive - startEff);
        const speed = clamp((M.te - 0.32) / avail, 1.45, 2.6);
        const at = 0.32 + since * speed;
        const armExtra = M.handLat - M.hipLat;
        const maxReach = K.reach * s.diff.keeperReach + armExtra;
        const want = Math.min(Math.abs(d.tx - kx2), maxReach);
        const k = clamp((want - armExtra) / M.hipLat, 0.06, 1.2);
        const lift = clamp(d.ty - M.handY, -0.6, 0.95);
        const bell = at < M.te + 0.15 ? clamp((at - 0.4) / (M.te - 0.4), 0, 1) : clamp(1 - (at - M.te - 0.15) / 0.45, 0, 1);
        kp.inPlace = false;
        kp.motionScale = { x: k, y: d.ty < 0.6 ? -0.5 : 0, z: 0.22, lift: lift * bell };
        kp.place(kx2, kz, Math.PI, d.side === 1);
        kp.pose("dive", Math.min(at, 2.15));
      } else {
        kp.inPlace = true;
        const at = 0.15 + since * 1.6;
        const jump = d.kind === "jump" ? 0.5 * Math.sin(clamp(since / 0.6, 0, 1) * Math.PI) : 0;
        kp.place(kx + d.px * d.side * clamp(since / 0.25, 0, 1), kz, Math.PI, false, jump);
        kp.pose(d.kind === "jump" ? "catch" : "scoop", Math.min(at, d.kind === "jump" ? 0.6 : 0.9));
      }
    }

    /* --- mur --- */
    const wz = this.wallZ();
    const xs = this.wallXs();
    const sinceK = this.phase === "flight" || this.phase === "done" ? this.t - this.kickT : -1;
    const jumpK = sinceK < 0.1 ? 0 : Math.sin(clamp((sinceK - 0.1) / 0.55, 0, 1) * Math.PI);
    A.wall.forEach((w, i) => {
      w.inPlace = true;
      w.place(xs[i], wz, Math.PI, false, 0.36 * jumpK);
      w.pose("catch", 0.02);
      const V = this.c3m!.THREE.Vector3;
      w.aim(B.lUpper, B.lFore, new V(0.25, -1, 0.35));
      w.aim(B.rUpper, B.rFore, new V(-0.25, -1, 0.35));
      w.aim(B.lFore, B.lHand, new V(-1, -0.4, 0.5));
      w.aim(B.rFore, B.rHand, new V(1, -0.4, 0.5));
    });
  }

  private celebrate3D(sh: Actor, c: number, scored: boolean, END: number) {
    const B = this.c3m!.BONE;
    const V = this.c3m!.THREE.Vector3;
    const P = this.celeb;
    sh.inPlace = true;
    const into = clamp(c / 0.4, 0, 1);
    if (!scored || this.setupData.reduced) {
      // déception : mains sur la tête
      sh.place(P.x, P.z, 0);
      sh.blend("kick", END, "catch", 0.02, into);
      const w = clamp((c - 0.15) / 0.4, 0, 1);
      if (!scored) {
        sh.aim(B.lUpper, B.lFore, new V(0.55, 0.8, 0.15), w);
        sh.aim(B.rUpper, B.rFore, new V(-0.55, 0.8, 0.15), w);
        sh.aim(B.lFore, B.lHand, new V(-0.85, 0.35, 0), w);
        sh.aim(B.rFore, B.rHand, new V(0.85, 0.35, 0), w);
      } else {
        sh.aim(B.lUpper, B.lFore, new V(0.4, 1, 0), w);
        sh.aim(B.rUpper, B.rFore, new V(-0.4, 1, 0), w);
      }
      return;
    }
    const kind = this.celebrationKind();
    const turn = Math.PI * easeInOut(clamp(c / 0.45, 0, 1));
    if (kind === "avion" || kind === "glissade") {
      // danses Mixamo, face aux tribunes
      const clip = kind === "avion" ? "twist" : "bboy";
      const dur = this.c3!.clips[clip]!.duration;
      sh.place(P.x, P.z, turn);
      sh.blend("kick", END, clip, (0.4 + c) % dur, into);
      return;
    }
    if (kind === "nom") {
      // dos aux caméras, les pouces vers le nom sur le maillot
      sh.place(P.x, P.z, 0, false, Math.abs(Math.sin(c * 5)) * 0.04);
      sh.blend("kick", END, "catch", 0.02, into);
      sh.aim(B.lUpper, B.lFore, new V(0.75, 0.55, -0.25), into);
      sh.aim(B.rUpper, B.rFore, new V(-0.75, 0.55, -0.25), into);
      sh.aim(B.lFore, B.lHand, new V(-0.35, 0.15, -1), into);
      sh.aim(B.rFore, B.rHand, new V(0.35, 0.15, -1), into);
      return;
    }
    if (kind === "poing") {
      const jump = c > 0.45 ? Math.max(0, Math.sin((c - 0.45) * 6.5)) * 0.3 : 0;
      sh.place(P.x, P.z, turn, false, jump);
      sh.blend("kick", END, "catch", 0.02, into);
      sh.aim(B.rUpper, B.rFore, new V(-0.2, 1, 0.1), into);
      sh.aim(B.rFore, B.rHand, new V(-0.05, 1, 0.05), into);
      sh.aim(B.lUpper, B.lFore, new V(0.45, -0.6, 0.5), into);
      sh.aim(B.lFore, B.lHand, new V(-0.2, 0.5, 1), into);
      return;
    }
    // fimbu : dernier but de la série, avec deux coéquipiers
    sh.place(P.x, P.z, turn);
    sh.blend("kick", END, "catch", 0.02, into);
    if (c > 0.35) this.fimbu3D(sh, c - 0.35, clamp((c - 0.35) / 0.3, 0, 1));
    this.mates3D(c, P);
  }

  /** La danse fimbu, procédurale sur le squelette. */
  private fimbu3D(a: Actor, t: number, w: number) {
    const B = this.c3m!.BONE;
    const V = this.c3m!.THREE.Vector3;
    const beat = t * Math.PI * 2 * 1.05;
    const s = Math.sin(beat);
    const bounce = Math.abs(Math.sin(beat));
    a.dropHips((0.15 + 0.04 * bounce) * w);
    a.root.rotation.z = 0.1 * s * w;
    a.aim(B.lThigh, B.lCalf, new V(0.55, -0.75, 0.3), w);
    a.aim(B.rThigh, B.rCalf, new V(-0.55, -0.75, 0.3), w);
    a.aim(B.lCalf, B.lFoot, new V(0.05, -1, -0.12), w);
    a.aim(B.rCalf, B.rFoot, new V(-0.05, -1, -0.12), w);
    a.aim(B.lUpper, B.lFore, new V(1, 0.08 * s, 0.12), w);
    a.aim(B.rUpper, B.rFore, new V(-1, -0.08 * s, 0.12), w);
    const whipL = Math.max(0, -s);
    const whipR = Math.max(0, s);
    a.aim(B.lFore, B.lHand, new V(1 - whipL, whipL * 1.2, 0.15), w);
    a.aim(B.rFore, B.rHand, new V(-(1 - whipR), whipR * 1.2, 0.15), w);
  }

  private mates3D(c: number, P: { x: number; z: number }) {
    const m = this.c3m!;
    if (!this.A.mates.length) {
      const skins = [BODIES[2].skin, BODIES[3].skin];
      this.A.mates = [4, 8].map((n, i) => this.c3!.actor({ ...m.LEOPARDS_PAINT("", n, skins[i], i ? "#be185d" : "#0e7490"), female: !!this.setupData.female }));
    }
    const t = c - 0.15;
    this.A.mates.forEach((a, i) => {
      const side = i === 0 ? -1 : 1;
      const tx = P.x + side * 1.3;
      const tz = P.z + 0.45;
      const k = clamp(t / 0.95, 0, 1);
      a.inPlace = true;
      if (k < 1) {
        const x = lerp(tx + side * 5, tx, easeOutCubic(k));
        a.place(x, tz, -side * Math.PI / 2);
        a.pose("kick", 0.12 + ((Math.max(0, t) * 1.15) % 0.42));
      } else {
        a.place(tx, tz, Math.PI);
        a.pose("catch", 0.02);
        this.fimbu3D(a, t - 0.95 + 0.25, clamp((t - 0.95) / 0.25, 0, 1));
      }
    });
  }

  /** Collision balle / gardien 3D (gants, bras, tronc, tête, jambes). */
  private keeperHit3D(): "glove" | "body" | null {
    const kp = this.A.keeper;
    if (!kp) return null;
    const B = this.c3m!.BONE;
    kp.root.updateMatrixWorld(true);
    const P = { x: this.bx, y: this.by, z: this.bz };
    const b = (n: string) => kp.bone(n);
    const lh = b(B.lHand);
    const rh = b(B.rHand);
    const lf = b(B.lFore);
    const rf = b(B.rFore);
    const ext = (h: typeof lh, e: typeof lh) => {
      const dx = h.x - e.x, dy = h.y - e.y, dz = h.z - e.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      return { x: h.x + (dx / l) * 0.09, y: h.y + (dy / l) * 0.09, z: h.z + (dz / l) * 0.09 };
    };
    const gL = ext(lh, lf);
    const gR = ext(rh, rf);
    const d3 = (a: typeof lh, c: typeof lh) => Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
    if (d3(P, gL) < 0.12 + BALL_R || d3(P, gR) < 0.12 + BALL_R) return "glove";
    const caps: [string, string, number][] = [
      [B.lFore, B.lHand, 0.065], [B.rFore, B.rHand, 0.065], [B.lUpper, B.lFore, 0.075], [B.rUpper, B.rFore, 0.075],
      [B.pelvis, B.neck, 0.19], [B.lThigh, B.lCalf, 0.1], [B.rThigh, B.rCalf, 0.1], [B.lCalf, B.lFoot, 0.075], [B.rCalf, B.rFoot, 0.075]
    ];
    for (let i = 0; i < caps.length; i++) {
      const [a, c, r] = caps[i];
      if (segDist3(P, b(a), b(c)) < r + BALL_R) return i < 2 ? "glove" : "body";
    }
    const hd = b(B.head);
    if (Math.hypot(P.x - hd.x, P.y - (hd.y + 0.08), P.z - hd.z) < 0.13 + BALL_R) return "body";
    return null;
  }

  /** Traînée de la trajectoire : montre la courbe de l'effet (dorée quand ça enroule fort). */
  private drawCurveTrail(ctx: CanvasRenderingContext2D) {
    const pts = this.curve;
    if (pts.length < 3) return;
    const age = this.outcome ? clamp((this.t - this.resolvedAt) / 1.2, 0, 1) : 0;
    if (age >= 1) return;
    const strong = this.pending && Math.abs(this.pending.ax) > 5;
    const n = pts.length;
    ctx.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const a = this.cam.p(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z);
      const b = this.cam.p(pts[i].x, pts[i].y, pts[i].z);
      const k = i / n;
      const alpha = (0.15 + 0.6 * k) * (1 - age);
      ctx.strokeStyle = strong ? `rgba(244,196,0,${alpha})` : `rgba(255,255,255,${alpha * 0.7})`;
      ctx.lineWidth = Math.max(1, BALL_R * b.s * (0.5 + 1.2 * k));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  private drawShadows3D(ctx: CanvasRenderingContext2D) {
    const B = this.c3m!.BONE;
    const all = [this.A.shooter, this.A.keeper, ...this.A.wall, ...this.A.mates].filter(Boolean) as Actor[];
    for (const a of all) {
      a.root.updateMatrixWorld(true);
      const h = a.bone(B.pelvis);
      const p = this.cam.p(h.x, 0, h.z);
      const lift = Math.max(0, h.y - 0.9);
      ctx.fillStyle = `rgba(0,0,0,${clamp(0.34 - lift * 0.2, 0.08, 0.34)})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 0.55 * p.s, 0.09 * p.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!this.ballHeld) {
      const sh = this.cam.p(this.bx, 0, this.bz);
      const hgt = this.by - BALL_R;
      ctx.fillStyle = `rgba(0,0,0,${clamp(0.4 - hgt * 0.08, 0.06, 0.4)})`;
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, BALL_R * sh.s * (1 + hgt * 0.15), BALL_R * sh.s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFingerTrail(ctx: CanvasRenderingContext2D) {
    const pts = this.fingerTrail;
    if (pts.length < 2) return;
    const now = performance.now();
    ctx.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      const a = 1 - (now - pts[i].t) / 260;
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(244,196,0,${a * 0.85})`;
      ctx.lineWidth = 2 + a * 7;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
}

/* ---------- collisions gardien ---------- */

function segDist3(p: { x: number; y: number; z: number }, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz || 1), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
}

function segDist(p: V, a: V, b: V): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function keeperHit(sk: Skeleton, x: number, y: number): "glove" | "body" | null {
  const P = { x, y };
  const R = BALL_R;
  const ext = (h: V, a: number, k: number): V => ({ x: h.x + Math.sin(a) * k, y: h.y - Math.cos(a) * k });
  const gL = ext(sk.haL, sk.foreAL + sk.wrL, 0.12);
  const gR = ext(sk.haR, sk.foreAR + sk.wrR, 0.12);
  if (Math.hypot(P.x - gL.x, P.y - gL.y) < 0.11 + R || Math.hypot(P.x - gR.x, P.y - gR.y) < 0.11 + R) return "glove";
  const caps: [V, V, number][] = [
    [sk.elL, sk.haL, 0.065], [sk.elR, sk.haR, 0.065], [sk.shL, sk.elL, 0.07], [sk.shR, sk.elR, 0.07],
    [sk.neck, sk.pelvis, 0.19], [sk.hipL, sk.knL, 0.1], [sk.hipR, sk.knR, 0.1], [sk.knL, sk.anL, 0.075], [sk.knR, sk.anR, 0.075]
  ];
  for (let i = 0; i < caps.length; i++) {
    const [a, b, r] = caps[i];
    if (segDist(P, a, b) < r + R) return i < 2 ? "glove" : "body";
  }
  if (Math.hypot(P.x - sk.head.x, P.y - sk.head.y) < sk.headR + R) return "body";
  return null;
}
