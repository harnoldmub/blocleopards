/**
 * Tirs au but — moteur de jeu (canvas 2D, perspective « caméra derrière le tireur »).
 * Un tir à la fois : le shell React gère la série, le score et les combos.
 */
import type { DiffCfg, FootStage } from "../lib/config";
import { audio } from "../lib/audio";
import { clamp, easeInOut, easeOutCubic, gauss, lerp, mulberry32 } from "../lib/rng";
import {
  BODIES, FEMALE_BODY, KICK, LEOPARDS_KIT, POSES, RIVAL_KIT, drawFigure, lerpPose, lerpSag, mirrorPose, runSag, sagPose, skeleton,
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
  female?: boolean;
  /** Personnage choisi par le joueur (voir ROSTER). */
  character?: string;
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
/** Coefficient Magnus : accélération = CM · (ω × v). */
const CM = 0.0068;
/** Amortissement de la rotation (1/s). */
const SPIN_DECAY = 0.28;

function ballAccel(v: V3, w: V3): V3 {
  const sp = Math.hypot(v.x, v.y, v.z);
  // Crise de traînée du ballon de football (Drag crisis aérodynamique) :
  // À haute vitesse (v > 22 m/s), la couche limite est turbulente et la traînée est minimale.
  // Quand le ballon ralentit (< 19 m/s), la traînée augmente, provoquant la rupture de trajectoire et le plongeon.
  const kd = sp > 22 ? 0.0102 : sp > 16 ? 0.0122 + (22 - sp) * 0.00065 : 0.0155;
  return {
    x: -kd * sp * v.x + CM * (w.y * v.z - w.z * v.y),
    y: -G - kd * sp * v.y + CM * (w.z * v.x - w.x * v.z),
    z: -kd * sp * v.z + CM * (w.x * v.y - w.y * v.x)
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
    const a1 = ballAccel(v, w);
    const midV = {
      x: v.x + a1.x * dt * 0.5,
      y: v.y + a1.y * dt * 0.5,
      z: v.z + a1.z * dt * 0.5
    };
    const a2 = ballAccel(midV, w);
    v.x += a2.x * dt;
    v.y += a2.y * dt;
    v.z += a2.z * dt;
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
    if (samples && i++ % 6 === 0) samples.push({ ...p });
  }
  if (samples) samples.push({ ...p });
  return { x: p.x, y: p.y, t };
}

/** Cherche la vitesse initiale qui amène le ballon au point visé malgré traînée et effet. */
function solveShot(p0: V3, tx: number, ty: number, D: number, speed: number, w: V3): V3 {
  const T = Math.hypot(D - p0.z, tx - p0.x) / speed;
  const v = { x: (tx - p0.x) / T, y: (ty - p0.y + 0.5 * G * T * T) / T, z: ((D - p0.z) / T) * 1.05 };
  for (let i = 0; i < 12; i++) {
    const r = flyTo(p0, v, w, D);
    const ex = tx - r.x;
    const ey = ty - r.y;
    if (Math.abs(ex) < 0.008 && Math.abs(ey) < 0.008) break;
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

  // poteau avec suspense et ambiance réactive
  private postHitPending: { timer: number; inside: boolean; postHit: boolean; p: NonNullable<FootEngine["pending"]> } | null = null;
  private crowdReaction: "idle" | "tense" | "goal" | "save" | "post" = "idle";

  // personnages 3D (facultatifs : repli 2D si WebGL indisponible)
  private c3: Chars3D | null = null;
  private c3m: C3Mod | null = null;
  private A: { shooter?: Actor; keeper?: Actor; wall: Actor[] } = { wall: [] };
  private celeb = { x: 0, z: 0, captured: false };
  private viewOff = { x: 0, y: 0 };

  async attach3D(c3: Chars3D, mod: C3Mod): Promise<void> {
    this.c3 = c3;
    this.c3m = mod;
    if (this.setupData) await this.build3D();
  }

  get use3d() {
    return !!(this.c3 && this.c3.ready && this.A.shooter && this.A.keeper);
  }

  private async build3D(): Promise<void> {
    const c3 = this.c3;
    const m = this.c3m;
    if (!c3 || !m || !c3.ready) return;
    const s = this.setupData;
    const fem = !!s.female;
    const kFem = !!s.stage.keeper.female;
    const pc = m.charById(s.character)?.female === fem ? s.character! : fem ? "leoparde" : "leopard";
    const kc = m.pickChar(kFem, s.stage.id * 7 + 3, [pc]).id;
    const wallIds = Array.from({ length: s.stage.wall }, (_, i) => m.pickChar(kFem, s.stage.id + i, [pc, kc]).id);
    const need = [pc, kc, ...wallIds];
    if (!c3.isLoaded(need)) {
      await c3.ensureChars(need);
    }
    c3.clearActors();
    this.A = { wall: [] };
    const hasJ = m.hasJersey(pc);
    this.A.shooter = c3.actor({ ...m.LEOPARDS_PAINT(s.name, hasJ ? s.number : undefined, this.shooterBody.skin), female: fem }, pc);
    this.A.keeper = c3.actor({ ...m.KEEPER_PAINT(s.stage.keeper.kit, this.keeperBody.skin), female: kFem }, kc);
    for (let i = 0; i < s.stage.wall; i++) {
      this.A.wall.push(c3.actor({ ...m.RIVAL_PAINT(4 + i * 3, this.wallBodies[i].skin), female: kFem }, wallIds[i]));
    }
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
    this.postHitPending = null;
    this.crowdReaction = "idle";
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
    this.keeperBody = s.stage.keeper.female
      ? { ...FEMALE_BODY, height: 1.8 + s.stage.id * 0.006 }
      : { ...BODIES[(s.stage.id + 1) % BODIES.length], height: 1.9 + s.stage.id * 0.01, bulk: 0.8 };
    const k = s.stage.keeper.kit;
    this.keeperKit = {
      jersey: k.jersey, jersey2: k.jersey2, trim: k.trim, shorts: k.shorts, socks: k.socks,
      boots: "#111827", gloves: k.gloves, gloves2: k.gloves2, longSleeves: true, number: "1"
    };
    this.keeperX = s.stage.ballX * 0.12;
    this.wallBodies = Array.from({ length: s.stage.wall }, (_, i) =>
      s.stage.keeper.female ? { ...FEMALE_BODY, height: 1.7 + (i % 3) * 0.03 } : BODIES[(i * 2 + 1) % BODIES.length]
    );
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
    const portrait = this.h > this.w;
    const fk = D > 15;
    // caméra TV : sur mobile pour les coups francs, recul net et hauteur pour embrasser le mur et la cage
    cam.x = fk ? (portrait ? bx * 0.45 - 0.75 : bx - 0.9) : bx + 0.55;
    cam.y = fk ? (portrait ? 5.2 : 4.5) : (portrait ? 4.1 : 3.9);
    cam.z = fk ? (portrait ? -14.2 : -11.5) : (portrait ? -12 : -11);
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
    // cadrage élargi sur mobile pour les coups francs : cage, mur et courbe entière visibles
    const fW = (this.w * (portrait ? (fk ? 0.65 : 0.74) : 0.58)) / uSpan;
    const fH = (this.h * (portrait ? (fk ? 0.44 : 0.50) : 0.52)) / vSpan;
    cam.f = Math.min(fW, fH);
    const ballY = this.h * (portrait ? (fk ? 0.76 : 0.81) : fk ? 0.78 : 0.84);
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
    const final = this.setupData.stage.id >= 15 || this.setupData.stage.id <= 0;

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
      // Texture des marches
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      ctx.fillRect(a.x, top, b.x - a.x, 1);
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
    // effet franc et banane : un geste courbé fait tourner le ballon avec une courbure marquée
    const maxAx = (fk ? 4.9 : 2.6) * 8 / (T * T);
    const ax = clamp((bulge / this.h) * 1150, -maxAx, maxAx);
    const over = v > (fk ? 27 : 31);
    if (!preview) {
      const n = this.setupData.diff.aimNoise * (0.1 + Math.max(0, v - 27) * 0.045);
      tx += gauss(this.rng) * n;
      ty += gauss(this.rng) * n * 0.8;
      if (over) ty += (v - (fk ? 27 : 31)) * 0.2;
    }
    ty = Math.max(BALL_R, ty);
    const zone = tx < -1.2 ? -1 : tx > 1.2 ? 1 : 0;
    // Topspin / "feuille morte" : plongeon prononcé au-dessus du mur pour retomber sous la barre
    const topspin = fk ? clamp(12 + (v - 16) * 0.85, 8, 28) : (v > 25 ? 12 : v < 17 ? -16 : 4);
    // Effet brossé latéral (Magnus réactif)
    const sideSpin = clamp(ax / (CM * v), -190, 190);
    // Frappe flottante (knuckleball) si tir ultra droit et rapide
    const isKnuckle = Math.abs(bulge) < this.h * 0.007 && v > 24;
    const w: V3 = {
      x: isKnuckle ? 2 : topspin,
      y: isKnuckle ? 0 : sideSpin,
      z: 0
    };
    return { tx, ty, v, ax, w, zone, over };
  }

  /** Durée d'affichage du résultat : célébration rythmée puis enchaînement rapide. */
  private resultDelay() {
    if (!this.outcome) return 99;
    return this.outcome.scored && !this.setupData.reduced ? 2.5 : 1.3;
  }

  /** Touche pendant la célébration : on passe immédiatement au tir suivant. */
  skip() {
    if (this.phase === "done" && this.outcome && !this.resultSent && this.t - this.resolvedAt > 0.35) {
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

    // suspense du rebond sur poteau / transversale
    if (this.postHitPending) {
      this.postHitPending.timer -= dt;
      if (this.postHitPending.timer <= 0) {
        const ph = this.postHitPending;
        this.postHitPending = null;
        if (ph.inside) {
          this.crowdReaction = "goal";
          this.goal(ph.p, ["post-in"], "Poteau rentrant !");
        } else {
          this.crowdReaction = "save";
          this.resolve({
            scored: false,
            base: 0,
            tags: ["post"],
            label: ph.postHit ? "Poteau !" : "Transversale !",
            detail: "À quelques centimètres…",
            zone: ph.p.zone
          });
          audio.crowd("groan");
        }
      }
    }

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
    const s = this.setupData;
    const stageId = s.stage.id || 0;
    const diff = s.diff;
    const diffMult = diff === "legende" ? 1.25 : diff === "pro" ? 1.1 : 0.95;
    const levelFactor = clamp(stageId / 15, 0.25, 1) * diffMult;
    // Plus le niveau est difficile, plus le saut du mur est haut et coordonné (détente jusqu'à 0.62m, hauteur 2.48m)
    const maxJump = 0.28 + levelFactor * 0.34;
    const delay = Math.max(0.04, 0.12 - levelFactor * 0.08);
    const duration = 0.54;
    const jumpK = since < delay ? 0 : Math.sin(clamp((since - delay) / duration, 0, 1) * Math.PI);
    return 1.86 + maxJump * jumpK;
  }

  private step(dt: number) {
    const D = this.D;
    if (this.ballHeld) return;
    const pz = this.bz;

    // Intégration RK2 par sous-pas pour une trajectoire fluide et réaliste
    const substeps = 4;
    const sdt = dt / substeps;
    for (let st = 0; st < substeps; st++) {
      if (this.ballHeld) break;
      const a1 = ballAccel({ x: this.vx, y: this.vy, z: this.vz }, this.omega);
      const midV = {
        x: this.vx + a1.x * sdt * 0.5,
        y: this.vy + a1.y * sdt * 0.5,
        z: this.vz + a1.z * sdt * 0.5
      };
      const a2 = ballAccel(midV, this.omega);
      this.vx += a2.x * sdt;
      this.vy += a2.y * sdt;
      this.vz += a2.z * sdt;
      const decay = 1 - SPIN_DECAY * sdt;
      this.omega.x *= decay;
      this.omega.y *= decay;
      this.bx += this.vx * sdt;
      this.by += this.vy * sdt;
      this.bz += this.vz * sdt;

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
        const f = Math.max(0, 1 - 1.6 * sdt);
        this.vx *= f;
        this.vz *= f;
      }
    }

    // mur : participation active des défenseurs, contrant de plus en plus avec la difficulté
    const wz = this.wallZ();
    if (this.setupData.stage.wall && !this.crossedWall && pz < wz && this.bz >= wz) {
      this.crossedWall = true;
      const top = this.wallTop();
      const s = this.setupData;
      const stageId = s.stage.id || 0;
      const diffMult = s.diff === "legende" ? 1.2 : s.diff === "pro" ? 1.1 : 1.0;
      const levelFactor = clamp(stageId / 15, 0.25, 1) * diffMult;
      const blockRadius = 0.26 + levelFactor * 0.07 + BALL_R;
      const xs = this.wallXs();
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        if (Math.abs(this.bx - x) < blockRadius && this.by - BALL_R < top) {
          this.vz = -Math.abs(this.vz) * 0.32;
          this.vx = (this.bx - x) * 9 + (this.rng() - 0.5) * 3;
          this.vy = 2.2 + this.rng() * 2;
          this.omega = { x: -8, y: (this.bx - x) * 20, z: 0 };
          this.shake = 0.6;
          audio.glove();
          this.crowdReaction = "save";
          const label = stageId >= 11 ? "Bloc Défensif Élite !" : stageId >= 6 ? "Mur Infranchissable !" : "Contré par le mur !";
          const detail = stageId >= 11
            ? "Les défenseurs ont sauté au sommet ! Enroule ta frappe ou contourne le mur."
            : stageId >= 6
            ? "Détente synchronisée du mur Léopard en plein vol !"
            : "Le mur a dévié ta frappe.";
          this.resolve({ scored: false, base: 0, tags: ["wall"], label, detail, zone: this.pending!.zone });
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
        this.crowdReaction = "save";
        audio.crowd("groan");
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
        if (!this.setupData.reduced) this.shake = 0.75;
        const inside = postHit ? ax < GOAL_W - 0.02 && this.rng() < 0.45 : y < GOAL_H - 0.03 && this.rng() < 0.4;
        if (inside) {
          this.vx *= -0.38;
          this.vz = Math.abs(this.vz) * 0.58;
          this.vy = Math.max(0.4, this.vy * -0.32);
        } else {
          this.vz = -Math.abs(this.vz) * 0.42;
          if (postHit) this.vx = Math.sign(x) * 3.2;
          else this.vy = Math.abs(this.vy) * 0.5 + 1.2;
        }
        audio.crowd("ooh");
        this.crowdReaction = "post";
        this.postHitPending = { timer: 0.38, inside, postHit, p };
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
    this.crowdReaction = "goal";
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
    this.drawAnimatedCrowd(ctx);
    this.drawJumboScreen(ctx);

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

  /** Célébration variée à chaque but. */
  private celebrationKind(): "glissade" | "poing" | "avion" | "siuu" | "salut" | "coeur" | "clapping" | "praying" {
    const list = ["siuu", "salut", "avion", "coeur", "glissade", "poing", "clapping", "praying"] as const;
    return list[(this.setupData.shot + (this.setupData.seed % 7)) % list.length];
  }

  private celebrationSpot() {
    const bx = this.setupData.stage.ballX;
    return { x: bx + 0.2, z: -1.6 };
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
    const SM = c3.metaFor(sh);
    const tc = SM.kickContact;
    const foot = SM.kickFoot;
    const rootX = s.stage.ballX - foot.x - 0.05;
    const rootZ = -foot.z - 0.14;
    const END = Math.min(tc + 0.5, sh.duration("kick") - 0.15);

    /* --- tireur --- */
    sh.motionScale = { x: 1, y: 0, z: 1, lift: 0 };
    sh.inPlace = false;
    const tAim = sh.rig === "mx" ? (D > 15 ? 0.12 : 0.02) : D > 15 ? 0.22 : 0.02;
    if (this.phase === "aim") {
      const breath = Math.sin(this.t * 2.8) * 0.015;
      sh.place(rootX, rootZ, 0, false, breath * 0.5);
      sh.pose("kick", tAim);
      const V = m.THREE.Vector3;
      sh.aim(B.spine2, B.neck, new V(0, 1, breath * 0.4));
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
      const shuffle = this.phase === "aim" ? Math.sin(this.t * 5.2) * 0.035 : 0;
      const hop = this.phase === "runup" ? 0.1 * Math.sin(clamp((this.phaseT - (RUN - 0.24)) / 0.24, 0, 1) * Math.PI) : (this.phase === "aim" ? Math.abs(Math.sin(this.t * 4.4)) * 0.025 : 0);
      kp.inPlace = true;
      kp.place(kx + sway + shuffle, kz, Math.PI, false, hop);
      kp.pose("catch", 0.02);
      // posture de gardien : fléchi, sur les appuis, bras ouverts paumes vers le tireur
      {
        const V = this.c3m!.THREE.Vector3;
        const bounce = Math.abs(Math.sin(this.t * 4.2)) * (this.setupData.reduced ? 0 : 1);
        kp.dropHips(0.14 + bounce * 0.035);
        kp.aim(B.lThigh, B.lCalf, new V(0.32, -0.85, 0.4));
        kp.aim(B.rThigh, B.rCalf, new V(-0.32, -0.85, 0.4));
        kp.aim(B.lCalf, B.lFoot, new V(0.08, -1, -0.12));
        kp.aim(B.rCalf, B.rFoot, new V(-0.08, -1, -0.12));
        kp.aim(B.lUpper, B.lFore, new V(0.75 + Math.sin(this.t * 2.8) * 0.05, -0.55, 0.45));
        kp.aim(B.rUpper, B.rFore, new V(-0.75 - Math.sin(this.t * 2.8) * 0.05, -0.55, 0.45));
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
      const KM = c3.metaFor(kp).dive;
      const T0 = kp.rig === "mx" ? 0.3 : 0.32;
      const isDive = d.kind === "low" || d.kind === "mid" || d.kind === "high";
      const natural = (KM.te - T0) / 1.9;
      const startEff = isDive ? Math.max(d.start, d.arrive - natural - 0.03) : d.start;
      const waitT = this.t - this.kickT - d.start;
      const shuffle = isDive && startEff > d.start ? clamp(d.tx - kx, -0.8, 0.8) * clamp(waitT / Math.max(0.2, startEff - d.start), 0, 1) * 0.75 : 0;
      const kx2 = kx + shuffle;
      const since = this.t - this.kickT - startEff;
      if (since < 0) {
        kp.inPlace = true;
        const stepping = kp.has("side") && Math.abs(shuffle) > 0.05;
        kp.place(kx2, kz, Math.PI, stepping && shuffle < 0, stepping ? 0 : waitT > 0 ? Math.abs(Math.sin(waitT * 9)) * 0.05 : 0);
        if (stepping) {
          // pas chassés : animation de déplacement latéral, dans le sens du replacement
          const sd = kp.duration("side");
          kp.pose("side", Math.min(sd - 0.02, (Math.abs(shuffle) / 1.1) * sd));
        } else kp.pose("catch", 0.02);
        if (waitT > 0 && !stepping) {
          const V = this.c3m!.THREE.Vector3;
          kp.dropHips(0.12);
          kp.aim(B.lThigh, B.lCalf, new V(0.32, -0.85, 0.4));
          kp.aim(B.rThigh, B.rCalf, new V(-0.32, -0.85, 0.4));
          kp.aim(B.lUpper, B.lFore, new V(0.75, -0.5, 0.45));
          kp.aim(B.rUpper, B.rFore, new V(-0.75, -0.5, 0.45));
        }
      } else if (isDive) {
        // plongeon calé sur l'arrivée du ballon : les gants atteignent le point visé au bon moment
        const M = KM;
        const K = s.stage.keeper;
        const avail = Math.max(0.16, d.arrive - startEff);
        const speed = clamp((M.te - T0) / avail, 1.45, 2.6);
        const at = T0 + since * speed;
        const armExtra = M.handLat - M.hipLat;
        const maxReach = K.reach * s.diff.keeperReach + armExtra;
        const want = Math.min(Math.abs(d.tx - kx2), maxReach);
        const k = clamp((want - armExtra) / M.hipLat, 0.06, 1.2);
        const lift = clamp(d.ty - M.handY, -0.6, 0.95);
        const bell = at < M.te + 0.15 ? clamp((at - 0.4) / (M.te - 0.4), 0, 1) : clamp(1 - (at - M.te - 0.15) / 0.45, 0, 1);
        const landT = at - (M.te + 0.15);
        const groundCompress = landT > 0 ? Math.max(0, Math.sin(Math.min(Math.PI, landT * 6.5))) * 0.08 : 0;
        kp.inPlace = false;
        kp.motionScale = { x: k, y: d.ty < 0.6 ? -0.5 : -groundCompress, z: 0.22, lift: lift * bell };
        // sens natif du plongeon mesuré sur le squelette : on mire seulement si besoin
        kp.place(kx2, kz, Math.PI, d.side === M.dir);
        // Mixamo : l'animation enchaîne le relevé après la parade
        kp.pose("dive", kp.rig === "mx" ? Math.min(at, kp.duration("dive") - 0.05) : Math.min(at, 2.15));
        if (groundCompress > 0.02) kp.dropHips(groundCompress);
      } else {
        kp.inPlace = true;
        const mxJ = kp.rig === "mx";
        const at = 0.15 + since * 1.6;
        // Mixamo : la détente est dans l'animation (saut bras tendus / plongeon court au sol)
        const jump = d.kind === "jump" && !mxJ ? 0.5 * Math.sin(clamp(since / 0.6, 0, 1) * Math.PI) : 0;
        kp.place(kx + d.px * d.side * clamp(since / 0.25, 0, 1), kz, Math.PI, mxJ && d.kind !== "jump" && d.side === 1, jump);
        if (mxJ) {
          if (d.kind === "jump") kp.pose("jump", Math.min(0.3 + since * 1.25, 1.3));
          else kp.pose("scoop", Math.min(0.15 + since * 1.4, 0.66));
        } else kp.pose(d.kind === "jump" ? "catch" : "scoop", Math.min(at, d.kind === "jump" ? 0.6 : 0.9));
      }
    }

    /* --- mur dynamique --- */
    const wz = this.wallZ();
    const xs = this.wallXs();
    const stageId = s.stage.id || 0;
    const diffMult = s.diff === "legende" ? 1.25 : s.diff === "pro" ? 1.1 : 0.95;
    const levelFactor = clamp(stageId / 15, 0.25, 1) * diffMult;
    const maxJump = 0.28 + levelFactor * 0.34;
    const sinceK = this.phase === "flight" || this.phase === "done" ? this.t - this.kickT : -1;
    const delay = Math.max(0.04, 0.12 - levelFactor * 0.08);
    const jumpK = sinceK < delay ? 0 : Math.sin(clamp((sinceK - delay) / 0.54, 0, 1) * Math.PI);

    A.wall.forEach((w, i) => {
      w.inPlace = true;
      const V = this.c3m!.THREE.Vector3;
      const lag = (i % 2 === 0 ? 0.015 : -0.015) * (1 - levelFactor * 0.4);
      const personalJump = maxJump * Math.max(0, jumpK + lag);
      const ballDiffX = this.bx - xs[i];
      // Participation active : le mur se resserre et s'incline légèrement vers le ballon
      const leanX = this.phase === "flight" && Math.abs(ballDiffX) < 1.3 ? clamp(ballDiffX * 0.12 * levelFactor, -0.15, 0.15) : 0;

      if (w.has("header")) {
        const ht = sinceK < 0 ? 0.25 : Math.min(w.duration("header") - 0.02, 0.72 + Math.max(0, sinceK - lag) * 1.5);
        w.place(xs[i] + leanX, wz, Math.PI, i % 2 === 1, personalJump * 0.5);
        w.pose("header", ht);
        if (sinceK < 0) {
          w.aim(B.lUpper, B.lFore, new V(0.25, -1, 0.35));
          w.aim(B.rUpper, B.rFore, new V(-0.25, -1, 0.35));
          w.aim(B.lFore, B.lHand, new V(-1, -0.4, 0.5));
          w.aim(B.rFore, B.rHand, new V(1, -0.4, 0.5));
        }
        return;
      }
      w.place(xs[i] + leanX, wz, Math.PI, false, personalJump);
      w.pose("catch", 0.02);
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
    if (!scored && !this.setupData.reduced) {
      // Réactions variées en cas de tir raté : miss (saut déçu), angry (colère/rage), defeated (abattu)
      const missPool: ("miss" | "angry" | "defeated")[] = ["miss", "angry", "defeated"];
      const missPick = missPool[(this.setupData.shot + (this.setupData.seed % 5)) % missPool.length];
      const clip = sh.has(missPick) ? missPick : sh.has("miss") ? "miss" : null;
      if (clip) {
        sh.place(P.x, P.z, 0);
        sh.blend("kick", END, clip, Math.min(sh.duration(clip) - 0.05, c * 0.9), into);
        return;
      }
    }
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
    if (kind === "clapping") {
      const clip = sh.has("clapping") ? "clapping" : "twist";
      const dur = sh.duration(clip);
      sh.place(P.x, P.z, turn);
      sh.blend("kick", END, clip, (0.2 + c) % dur, into);
      return;
    }
    if (kind === "praying") {
      const clip = sh.has("praying") ? "praying" : "twist";
      const dur = sh.duration(clip);
      sh.place(P.x, P.z, turn);
      sh.blend("kick", END, clip, Math.min(dur - 0.05, c * 0.9), into);
      return;
    }
    if (kind === "siuu") {
      const jump = c < 0.65 ? Math.sin((c / 0.65) * Math.PI) * 0.42 : 0;
      const rot = easeInOut(clamp(c / 0.55, 0, 1)) * Math.PI;
      sh.place(P.x, P.z, rot, false, jump);
      sh.blend("kick", END, "catch", 0.02, into);
      if (c >= 0.5) {
        sh.aim(B.lUpper, B.lFore, new V(0.5, -0.85, -0.35), into);
        sh.aim(B.rUpper, B.rFore, new V(-0.5, -0.85, -0.35), into);
        sh.aim(B.lFore, B.lHand, new V(0.2, -0.9, -0.2), into);
        sh.aim(B.rFore, B.rHand, new V(-0.2, -0.9, -0.2), into);
        sh.aim(B.lThigh, B.lCalf, new V(0.4, -0.85, 0.2), into);
        sh.aim(B.rThigh, B.rCalf, new V(-0.4, -0.85, 0.2), into);
      }
      return;
    }
    if (kind === "salut") {
      sh.place(P.x, P.z, turn);
      sh.blend("kick", END, "catch", 0.02, into);
      sh.aim(B.rUpper, B.rFore, new V(-0.7, 0.45, 0.35), into);
      sh.aim(B.rFore, B.rHand, new V(0.75, 0.65, -0.1), into);
      sh.aim(B.lUpper, B.lFore, new V(0.12, -0.95, 0.1), into);
      sh.aim(B.lFore, B.lHand, new V(0.05, -0.95, 0.1), into);
      return;
    }
    if (kind === "coeur") {
      sh.place(P.x, P.z, turn, false, Math.sin(c * 4) * 0.02);
      sh.blend("kick", END, "catch", 0.02, into);
      sh.aim(B.lUpper, B.lFore, new V(0.65, 0.3, 0.35), into);
      sh.aim(B.rUpper, B.rFore, new V(-0.65, 0.3, 0.35), into);
      sh.aim(B.lFore, B.lHand, new V(-0.35, 0.45, 0.7), into);
      sh.aim(B.rFore, B.rHand, new V(0.35, 0.45, 0.7), into);
      return;
    }
    if (kind === "avion" || kind === "glissade") {
      // danses Mixamo, face aux tribunes
      const clip = kind === "avion" ? "twist" : "bboy";
      const dur = sh.duration(clip);
      sh.place(P.x, P.z, turn);
      sh.blend("kick", END, clip, (0.4 + c) % dur, into);
      return;
    }
    {
      // poing levé, petits sauts face aux tribunes
      const jump = c > 0.45 ? Math.max(0, Math.sin((c - 0.45) * 6.5)) * 0.3 : 0;
      sh.place(P.x, P.z, turn, false, jump);
      sh.blend("kick", END, "catch", 0.02, into);
      sh.aim(B.rUpper, B.rFore, new V(-0.2, 1, 0.1), into);
      sh.aim(B.rFore, B.rHand, new V(-0.05, 1, 0.05), into);
      sh.aim(B.lUpper, B.lFore, new V(0.45, -0.6, 0.5), into);
      sh.aim(B.lFore, B.lHand, new V(-0.2, 0.5, 1), into);
      return;
    }
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
    const all = [this.A.shooter, this.A.keeper, ...this.A.wall].filter(Boolean) as Actor[];
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

  /* ------------------------------------------------------------------ */
  /* Tribunes animées & Écran géant officiel (sans supporters devant)    */
  /* ------------------------------------------------------------------ */

  /** Rectangle écran de l'écran géant affichant les 2 logos les plus importants */
  private getJumboRect(): { x: number; y: number; w: number; h: number } | null {
    const W = this.w;
    const cam = this.cam;
    const D = this.D;
    const boardZ = D + 3.2;
    const standsTop = 64;
    const standsBottom = cam.p(0, 0, boardZ).y - 30;
    const avail = standsBottom - standsTop;
    if (avail <= 70) return null;
    const sh = clamp(avail * 0.62, 60, 170);
    const sw = Math.min(W * 0.86, sh * 2.5);
    const sx = (W - sw) / 2;
    const sy = standsTop + (avail - sh) * 0.38;
    return { x: sx, y: sy, w: sw, h: sh };
  }

  /** Affiche l'écran géant avec les deux logos officiels au premier plan net, sans aucun obstacle */
  private drawJumboScreen(ctx: CanvasRenderingContext2D) {
    const rect = this.getJumboRect();
    if (!rect) return;
    const { x: sx, y: sy, w: sw, h: sh } = rect;
    const cam = this.cam;
    const D = this.D;
    const boardZ = D + 3.2;
    const standsBottom = cam.p(0, 0, boardZ).y - 30;
    const final = this.setupData.stage.id >= 15 || this.setupData.stage.id <= 0;

    ctx.save();
    // 1. Cadre sombre et pied sous l'écran
    ctx.fillStyle = "#020617";
    ctx.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx + sw * 0.45, sy + sh + 6, sw * 0.1, Math.max(0, standsBottom - sy - sh));

    // 2. Fond LED bleu officiel
    const gr = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    gr.addColorStop(0, "#0B47B0");
    gr.addColorStop(1, "#08132B");
    ctx.fillStyle = gr;
    ctx.fillRect(sx, sy, sw, sh);

    // 3. Logo BLOC LÉOPARDS à gauche
    const logo = brandImage(LOGO_BL);
    const lh = sh * 0.84;
    if (logo) {
      const lw = (lh * logo.naturalWidth) / logo.naturalHeight;
      ctx.drawImage(logo, sx + sh * 0.1, sy + (sh - lh) / 2, lw, lh);
      const rest = sw - lw - sh * 0.3;
      // 4. Logo RD CONGO CŒUR DE L'AFRIQUE à droite
      drawBrandPanel(ctx, sx + lw + sh * 0.2, sy + sh * 0.24, rest, sh * 0.42, "rdc", "rgba(0,0,0,0)");
    } else {
      drawBrandPanel(ctx, sx, sy + sh * 0.3, sw, sh * 0.4, "rdc", "rgba(0,0,0,0)");
    }

    // 5. Lignes de balayage écran LED
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = sy; y < sy + sh; y += 3) ctx.fillRect(sx, y, sw, 1);

    // 6. Bordure or nette délimitant l'écran
    ctx.strokeStyle = "rgba(244, 196, 0, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sx, sy, sw, sh);

    if (final) {
      ctx.fillStyle = "#F4C400";
      ctx.font = `${Math.round(sh * 0.15)}px 'Bebas Neue', Anton, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(this.setupData.stage.name.toUpperCase(), sx + sw - 8, sy + sh * 0.2);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  private drawAnimatedCrowd(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const D = this.D;
    const standZ0 = D + 7;
    const rows = 26;
    const W = this.w;
    const t = this.t;
    const reaction = this.crowdReaction;

    // Zone d'exclusion totale pour préserver à 100% les 2 logos
    const screen = this.getJumboRect();
    const noGoLeft = screen ? screen.x - 20 : -999;
    const noGoRight = screen ? screen.x + screen.w + 20 : -999;
    const noGoTop = screen ? screen.y - 30 : -999;
    const noGoBottom = screen ? screen.y + screen.h + 32 : -999;
    const inScreen = (px: number, py: number) => !!(screen && px >= noGoLeft && px <= noGoRight && py >= noGoTop && py <= noGoBottom);

    // 1. Gradins éloignés (r = 8 à 25) : rendu allégé LOD
    for (let r = rows - 1; r >= 7; r -= 2) {
      const z = standZ0 + r * 1.05;
      const y = 1.2 + r * 0.72;
      const top = cam.p(0, y + 0.72, z + 1.05).y;
      const bot = cam.p(0, y, z).y;
      if (bot < 0 || top > this.h) continue;
      const h = Math.max(2, bot - top);
      const a = cam.p(-45, y, z);
      const b = cam.p(45, y, z);
      const wave = Math.sin(t * 3.2 + r * 0.45) * (reaction === "goal" ? 2.5 : 0.8);
      const lineY = top + wave;

      ctx.fillStyle = r % 4 === 0 ? "#142247" : "#0d1730";
      if (screen && lineY >= noGoTop && lineY <= noGoBottom) {
        // Tronçon gauche de la tribune
        const leftEndX = Math.min(b.x, noGoLeft);
        if (leftEndX > a.x) {
          ctx.fillRect(Math.max(0, a.x), lineY, leftEndX - Math.max(0, a.x), h);
        }
        // Tronçon droit de la tribune
        const rightStartX = Math.max(a.x, noGoRight);
        if (b.x > rightStartX) {
          ctx.fillRect(rightStartX, lineY, Math.min(W, b.x) - rightStartX, h);
        }
      } else {
        ctx.fillRect(Math.max(0, a.x), lineY, Math.min(W, b.x) - Math.max(0, a.x), h);
      }
      // silhouettes lointaines : têtes et maillots, qui sautent sur un but
      if (h >= 2.5) {
        const st = Math.max(2.4, h * 0.62);
        let k = r * 53;
        for (let x = Math.max(0, a.x) + (r % 3); x < Math.min(W, b.x); x += st) {
          k++;
          const hop = reaction === "goal" ? Math.abs(Math.sin(t * 8 + k)) * h * 0.35 : 0;
          const fy = lineY + h * 0.18 - hop;
          if (inScreen(x, fy)) continue;
          ctx.fillStyle = FAN_SHIRTS[(k * 7) % FAN_SHIRTS.length];
          ctx.fillRect(x - st * 0.36, fy + h * 0.32, st * 0.72, h * 0.62);
          ctx.fillStyle = FAN_SKIN[(k * 5) % FAN_SKIN.length];
          ctx.fillRect(x - st * 0.18, fy, st * 0.36, h * 0.34);
          if (reaction === "goal" && k % 3 === 0) ctx.fillRect(x - st * 0.4, fy - h * 0.3, st * 0.12, h * 0.4);
        }
      }
    }

    // 2. Gradins intermédiaires (r = 3 à 6)
    for (let r = 6; r >= 3; r--) {
      const z = standZ0 + r * 1.05;
      const y = 1.2 + r * 0.72;
      const top = cam.p(0, y + 0.72, z + 1.05).y;
      const bot = cam.p(0, y, z).y;
      const h = bot - top;
      if (h < 3) continue;
      const a = cam.p(-30, y, z);
      const b = cam.p(30, y, z);
      const step = Math.max(7, h * 0.95);
      const startX = Math.max(0, a.x);
      const endX = Math.min(W, b.x);
      let idx = r * 19;
      for (let x = startX + (r % 4) * 3; x < endX; x += step) {
        idx++;
        const phase = (idx * 1.618) % (Math.PI * 2);
        const freq = 2.6 + (idx % 3) * 0.8;
        let bounce = 0;
        let armsUp = false;
        if (reaction === "goal") {
          bounce = Math.abs(Math.sin(t * 8 + phase)) * h * 0.42;
          armsUp = true;
        } else if (reaction === "save") {
          bounce = -h * 0.12;
        } else if (reaction === "post") {
          bounce = 0;
        } else {
          bounce = Math.sin(t * freq + phase) * h * 0.16;
          armsUp = idx % 6 === 0;
        }
        const cy = top + h * 0.38 - bounce;

        // Protection : AUCUN supporter ne doit entrer dans la zone de l'écran géant
        if (inScreen(x, cy) || inScreen(x, cy - h * 0.75) || inScreen(x - h * 0.45, cy) || inScreen(x + h * 0.45, cy)) continue;

        drawFan(ctx, x, cy, h, idx, armsUp ? (idx % 4 === 0 ? "phone" : "up") : idx % 5 === 0 ? "clap" : "rest", t);
      }
    }

    // 3. Premiers rangs & Cœur du Bloc Léopards
    this.drawBlocLeopardsCore(ctx, standZ0, screen);
  }

  /** Le cœur vibrant du Bloc Léopards : supporters, tambours et drapeaux placés autour de l'écran sans le cacher */
  private drawBlocLeopardsCore(ctx: CanvasRenderingContext2D, standZ0: number, screen: { x: number; y: number; w: number; h: number } | null) {
    const cam = this.cam;
    const t = this.t;
    const reaction = this.crowdReaction;
    const noGoLeft = screen ? screen.x - 20 : -999;
    const noGoRight = screen ? screen.x + screen.w + 20 : -999;
    const noGoTop = screen ? screen.y - 30 : -999;
    const noGoBottom = screen ? screen.y + screen.h + 32 : -999;
    const inScreen = (px: number, py: number) => !!(screen && px >= noGoLeft && px <= noGoRight && py >= noGoTop && py <= noGoBottom);

    // Rangs 0, 1, 2
    for (let r = 2; r >= 0; r--) {
      const z = standZ0 + r * 1.1;
      const y = 1.25 + r * 0.74;
      const pTop = cam.p(0, y + 0.74, z + 1.1);
      const pBot = cam.p(0, y, z);
      const h = pBot.y - pTop.y;
      if (h < 4) continue;
      const pLeft = cam.p(-25, y, z);
      const pRight = cam.p(25, y, z);
      const numSupporters = Math.round((pRight.x - pLeft.x) / (h * 0.88));
      const step = (pRight.x - pLeft.x) / Math.max(16, numSupporters);

      for (let i = 0; i < numSupporters; i++) {
        const x = pLeft.x + i * step;
        if (x < -20 || x > this.w + 20) continue;
        const hash = (i * 37 + r * 101) % 1000;
        const phase = (hash * 0.031) % (Math.PI * 2);
        const speed = 2.8 + (hash % 5) * 0.4;
        const worldX = -25 + (i / numSupporters) * 50;

        let hop = 0;
        let role: "drum" | "flag" | "cheer" | "clap" | "wave" = "cheer";

        // Tambours positionnés sur les côtés des tribunes basses
        if (r === 0 && (Math.abs(worldX - -12) < 1.4 || Math.abs(worldX - 12) < 1.4)) {
          role = "drum";
        }
        // Drapeaux UNIQUEMENT sur les ailes latérales extérieures, strictement loin de l'écran des logos
        else if ((worldX <= -11 || worldX >= 11) && (hash % 6 === 0 || (r === 1 && (worldX < -13 || worldX > 13)))) {
          role = "flag";
        } else if (hash % 4 === 0) {
          role = "clap";
        } else if (hash % 3 === 0) {
          role = "wave";
        }

        if (reaction === "goal") {
          hop = Math.abs(Math.sin(t * 9 + phase)) * h * 0.45;
        } else if (reaction === "save") {
          hop = -h * 0.14;
        } else if (reaction === "post") {
          hop = 0;
        } else {
          hop = Math.abs(Math.sin(t * speed + phase)) * h * 0.18;
        }

        const cy = pTop.y + h * 0.35 - hop;

        // INTERDICTION FORMELLE : Aucun supporter dans la zone de l'écran géant
        if (inScreen(x, cy) || inScreen(x, cy - h * 0.75) || inScreen(x - h * 0.45, cy) || inScreen(x + h * 0.45, cy)) continue;

        const pose: FanPose =
          role === "drum" ? "rest" : role === "flag" ? "flag" : role === "clap" ? "clap" : role === "wave" ? "wave" : reaction === "goal" || hash % 5 === 0 ? "up" : "rest";
        drawFan(ctx, x, cy, h, hash, reaction === "goal" && pose !== "flag" && role !== "drum" ? "up" : pose, t);

        // 1. TAMBOUR (sur les côtés latéraux uniquement)
        if (role === "drum" && r === 0) {
          const drumW = h * 0.52;
          const drumH = h * 0.38;
          const drumY = cy + h * 0.42;
          ctx.fillStyle = "#F4C400";
          ctx.fillRect(x - drumW / 2, drumY, drumW, drumH);
          ctx.fillStyle = "#0B47B0";
          ctx.fillRect(x - drumW / 2, drumY + drumH * 0.28, drumW, drumH * 0.44);
          ctx.fillStyle = "#ce1021";
          ctx.fillRect(x - drumW / 2, drumY + drumH * 0.42, drumW, drumH * 0.16);
          ctx.fillStyle = "#fff8e7";
          ctx.beginPath();
          ctx.ellipse(x, drumY, drumW / 2, drumH * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          const beatL = Math.sin(t * 8.5);
          const beatR = Math.sin(t * 8.5 + Math.PI);
          ctx.strokeStyle = "#5c3317";
          ctx.lineWidth = Math.max(1.5, h * 0.09);
          ctx.beginPath();
          ctx.moveTo(x - h * 0.24, cy + h * 0.25);
          ctx.lineTo(x - h * 0.12, drumY - drumH * 0.1 + beatL * 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + h * 0.24, cy + h * 0.25);
          ctx.lineTo(x + h * 0.12, drumY - drumH * 0.1 + beatR * 4);
          ctx.stroke();
        }
        // 2. DRAPEAU (sur les ailes uniquement, ne dépasse jamais sur les logos)
        else if (role === "flag") {
          const flagH = h * 0.85;
          const flagW = flagH * 1.45;
          const poleH = h * 1.55;
          const topX = x + h * 0.35;
          const topY = cy - poleH + h * 0.2;
          // Sécurité stricte : la hampe et la toile du drapeau doivent rester entièrement hors de l'écran des logos
          const okLeft = !screen || topX + flagW < screen.x - 12;
          const okRight = !screen || topX > screen.x + screen.w + 12;
          if (okLeft || okRight) {
            const waveSpeed = reaction === "goal" ? 8 : 4.5;
            const waveAmp = reaction === "goal" ? h * 0.16 : h * 0.09;
            ctx.strokeStyle = "rgba(255,255,255,0.75)";
            ctx.lineWidth = Math.max(1.5, h * 0.07);
            ctx.beginPath();
            ctx.moveTo(x + h * 0.15, cy + h * 0.2);
            ctx.lineTo(topX, topY);
            ctx.stroke();

            const isRDC = hash % 2 === 0;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(topX, topY);
            for (let seg = 1; seg <= 6; seg++) {
              const u = seg / 6;
              const px = topX + u * flagW;
              const py = topY + Math.sin(t * waveSpeed + u * 3.8 + phase) * waveAmp * u;
              ctx.lineTo(px, py);
            }
            for (let seg = 6; seg >= 0; seg--) {
              const u = seg / 6;
              const px = topX + u * flagW;
              const py = topY + flagH + Math.sin(t * waveSpeed + u * 3.8 + phase) * waveAmp * u;
              ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = isRDC ? "#007fff" : "#0B47B0";
            ctx.fill();

            if (isRDC) {
              ctx.strokeStyle = "#ce1021";
              ctx.lineWidth = Math.max(2, flagH * 0.22);
              ctx.beginPath();
              ctx.moveTo(topX, topY + flagH * 0.85);
              ctx.lineTo(topX + flagW * 0.85, topY + flagH * 0.15);
              ctx.stroke();
              ctx.fillStyle = "#F4C400";
              ctx.beginPath();
              ctx.arc(topX + flagW * 0.22, topY + flagH * 0.3, flagH * 0.14, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = "#F4C400";
              ctx.font = `900 ${Math.round(flagH * 0.38)}px sans-serif`;
              ctx.fillText("BL", topX + flagW * 0.2, topY + flagH * 0.65);
            }
            ctx.restore();
          }
        }
      }
    }
  }
}

/* ---------- supporters dessinés ---------- */

const FAN_SKIN = ["#3b2214", "#4a2c1a", "#5a3520", "#6b4128", "#7a4b2e", "#8d5a3b"];
const FAN_SHIRTS = ["#2fa2e3", "#2fa2e3", "#1466E0", "#F4C400", "#d81e27", "#f8fafc", "#2fa2e3", "#0B47B0", "#111827"];
const FAN_WAX = ["#d81e27", "#F4C400", "#16a34a", "#7c3aed", "#ea580c"];
type FanPose = "rest" | "up" | "clap" | "wave" | "phone" | "flag";

/** Un supporter en buste (épaules, cou, visage ombré, coiffure, maillot, écharpe), animé selon sa pose. */
function drawFan(ctx: CanvasRenderingContext2D, x: number, cy: number, h: number, seed: number, pose: FanPose, t: number) {
  const k = Math.abs(seed | 0);
  const female = k % 5 === 1 || k % 5 === 3;
  const skin = FAN_SKIN[(k * 7) % FAN_SKIN.length];
  const shirt = FAN_SHIRTS[(k * 3) % FAN_SHIRTS.length];
  const hr = h * (female ? 0.165 : 0.175); // rayon de tête
  const hx = x + Math.sin(t * 1.3 + k) * h * 0.015;
  const hy = cy + h * 0.13;
  const shW = h * (female ? 0.27 : 0.31); // demi-largeur d'épaules
  const shY = cy + h * 0.36;
  const detail = h >= 9;

  // bras derrière le buste quand ils sont levés
  const arm = (side: -1 | 1, ex: number, ey: number, hx2: number, hy2: number) => {
    ctx.strokeStyle = shirt;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.4, h * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + side * shW * 0.85, shY + h * 0.04);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(1.2, h * 0.09);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx2, hy2, Math.max(0.8, h * 0.055), 0, Math.PI * 2);
    ctx.fill();
  };
  const sw = Math.sin(t * 6 + k);
  if (pose === "up") {
    arm(-1, x - shW * 1.25, shY - h * 0.3, x - shW * 1.05 + sw * h * 0.06, shY - h * 0.66);
    arm(1, x + shW * 1.25, shY - h * 0.3, x + shW * 1.05 + sw * h * 0.06, shY - h * 0.66);
  } else if (pose === "wave") {
    arm(1, x + shW * 1.3, shY - h * 0.25, x + shW * 1.25 + sw * h * 0.18, shY - h * 0.62);
  } else if (pose === "phone") {
    arm(1, x + shW * 1.1, shY - h * 0.32, x + shW * 0.85, shY - h * 0.6);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x + shW * 0.85 - h * 0.05, shY - h * 0.74, h * 0.1, h * 0.16);
    ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * Math.abs(Math.sin(t * 2 + k))})`;
    ctx.fillRect(x + shW * 0.85 - h * 0.035, shY - h * 0.72, h * 0.07, h * 0.12);
  }

  // buste : épaules arrondies, maillot
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(x - shW, shY + h * 0.62);
  ctx.lineTo(x - shW, shY + h * 0.08);
  ctx.quadraticCurveTo(x - shW, shY - h * 0.02, x - shW * 0.55, shY - h * 0.03);
  ctx.lineTo(x + shW * 0.55, shY - h * 0.03);
  ctx.quadraticCurveTo(x + shW, shY - h * 0.02, x + shW, shY + h * 0.08);
  ctx.lineTo(x + shW, shY + h * 0.62);
  ctx.closePath();
  ctx.fill();
  if (detail) {
    // ombre latérale (volume) + liseré du maillot des Léopards
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x + shW * 0.35, shY + h * 0.02, shW * 0.65, h * 0.6);
    if (shirt === "#2fa2e3" || shirt === "#1466E0") {
      ctx.fillStyle = "#d81e27";
      ctx.fillRect(x - shW, shY + h * 0.06, shW * 0.22, h * 0.05);
      ctx.fillRect(x + shW * 0.78, shY + h * 0.06, shW * 0.22, h * 0.05);
    }
  }
  // écharpe RDC (bleu, jaune, rouge) ou col
  if (k % 3 === 0) {
    const sy = shY + h * 0.0;
    ctx.fillStyle = "#007fff";
    ctx.fillRect(x - shW * 0.6, sy, shW * 1.2, h * 0.07);
    ctx.fillStyle = "#F4C400";
    ctx.fillRect(x - shW * 0.6, sy + h * 0.07, shW * 1.2, h * 0.03);
    ctx.fillStyle = "#d81e27";
    ctx.fillRect(x - shW * 0.22, sy + h * 0.1, shW * 0.24, h * 0.24);
  }
  // cou
  ctx.fillStyle = skin;
  ctx.fillRect(x - hr * 0.42, hy + hr * 0.6, hr * 0.84, shY - hy - hr * 0.5);

  // cheveux longs derrière la tête (tresses)
  const style = female ? (k * 7) % 4 : 4 + ((k * 3) % 4);
  if (style === 0 && detail) {
    ctx.fillStyle = "#120c08";
    ctx.fillRect(hx - hr * 1.05, hy - hr * 0.2, hr * 2.1, hr * 2.1);
  }
  // tête ombrée
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(hx, hy, hr * 0.88, hr, 0, 0, Math.PI * 2);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.3, hy + hr * 0.1, hr * 0.55, hr * 0.85, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    // bouche ouverte qui chante
    ctx.fillStyle = "#2a0f08";
    const mo = pose === "up" || pose === "wave" ? 0.16 + 0.1 * Math.abs(sw) : 0.07;
    ctx.beginPath();
    ctx.ellipse(hx, hy + hr * 0.48, hr * 0.2, hr * mo, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // coiffures
  ctx.fillStyle = "#120c08";
  if (style === 0 || style === 4) {
    // tresses / coupe courte : calotte
    ctx.beginPath();
    ctx.ellipse(hx, hy - hr * 0.3, hr * 0.92, hr * 0.72, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style === 1 || style === 5) {
    // afro
    ctx.beginPath();
    ctx.arc(hx, hy - hr * 0.35, hr * (female ? 1.08 : 0.98), Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  } else if (style === 2) {
    // chignon haut
    ctx.beginPath();
    ctx.ellipse(hx, hy - hr * 0.3, hr * 0.9, hr * 0.7, 0, Math.PI, Math.PI * 2);
    ctx.arc(hx, hy - hr * 1.05, hr * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 3) {
    // foulard en wax
    ctx.fillStyle = FAN_WAX[k % FAN_WAX.length];
    ctx.beginPath();
    ctx.ellipse(hx, hy - hr * 0.42, hr * 1.02, hr * 0.85, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.arc(hx + hr * 0.5, hy - hr * 1.0, hr * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 6) {
    // casquette
    ctx.fillStyle = k % 2 ? "#1466E0" : "#d81e27";
    ctx.beginPath();
    ctx.ellipse(hx, hy - hr * 0.35, hr * 0.95, hr * 0.68, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx - hr * 0.2, hy - hr * 0.42, hr * 1.25, hr * 0.18);
  } else if (style === 7 && detail) {
    // peinture tricolore sur le visage
    ctx.fillStyle = "rgba(0,127,255,0.75)";
    ctx.fillRect(hx - hr * 0.7, hy - hr * 0.15, hr * 0.4, hr * 0.5);
    ctx.fillStyle = "rgba(244,196,0,0.8)";
    ctx.fillRect(hx - hr * 0.3, hy - hr * 0.15, hr * 0.2, hr * 0.5);
  }

  // mains devant (applaudissements)
  if (pose === "clap") {
    const d = Math.abs(Math.sin(t * 8 + k)) * h * 0.14;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x - d - h * 0.02, shY + h * 0.18, Math.max(0.8, h * 0.065), 0, Math.PI * 2);
    ctx.arc(x + d + h * 0.02, shY + h * 0.18, Math.max(0.8, h * 0.065), 0, Math.PI * 2);
    ctx.fill();
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
