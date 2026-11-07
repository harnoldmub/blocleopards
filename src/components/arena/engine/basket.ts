/**
 * Shoot à la sirène — moteur basket (canvas 2D, caméra par-dessus l'épaule du tireur).
 * Geste : appuie, tire vers le haut pour doser (jauge), relâche dans la zone verte.
 */
import type { BasketStage, DiffCfg } from "../lib/config";
import { audio } from "../lib/audio";
import { clamp, easeInOut, easeOutCubic, gauss, lerp, mulberry32 } from "../lib/rng";
import {
  BODIES, FEMALE_BODY, LEOPARDS_BASKET_KIT, POSES, RIVAL_BASKET_KIT, drawFigure, lerpPose, skeleton,
  type Body, type Kit, type Pose
} from "./people";
import {
  Camera, LOGO_BL, LOGO_RDC, brandImage, confettiBurst, drawBasketball, drawBrandPanel, drawParticles, drawPartnerPanel,
  onBrandLoad, updateParticles, type Particle
} from "./scene";
import type { EngineCallbacks, ShotOutcome } from "./foot";
import type { Actor, Chars3D } from "./chars3d";

type C3Mod = typeof import("./chars3d");

export interface BasketSetup {
  stage: BasketStage;
  diff: DiffCfg;
  seed: number;
  shot: number;
  name: string;
  number: number;
  reduced: boolean;
  fire: boolean;
  money: boolean;
  fast: boolean;
  female?: boolean;
}

const G = 9.81;
const R = 0.12;
const RIM_Y = 3.05;
const RIM_R = 0.225;
const BOARD_Z = 0.375;

type Phase = "idle" | "aim" | "release" | "flight" | "done";
type Kind = "swish" | "rim-in" | "rim-out" | "bank-in" | "board-out" | "short" | "wide" | "block";

export class BasketEngine {
  private ctx: CanvasRenderingContext2D;
  private cam = new Camera();
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private bgDirty = true;
  private s!: BasketSetup;
  private rng = mulberry32(1);
  private t = 0;
  private phase: Phase = "idle";
  private phaseT = 0;
  private parts: Particle[] = [];
  private unsub: () => void;

  private spot = { d: 4.6, a: 0, three: false, label: "" };
  private S = { x: 0, z: -4.6 };
  private u = { x: 0, z: 1 };
  private perp = { x: 1, z: 0 };
  private body: Body = BODIES[0];
  private kit: Kit = LEOPARDS_BASKET_KIT("LÉOPARD", 10);
  private defBody: Body = BODIES[4];

  // geste
  private touch: { x0: number; y0: number; x: number; y: number; t0: number } | null = null;
  private power = 0;
  private aimX = 0;
  private ideal = 0.6;
  private windowW = 0.1;

  // défenseur
  private defT0 = -1;
  private defJumpAt = 99;

  // ballon
  private bx = 0;
  private by = 1;
  private bz = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private spin = 0;
  private held = true;
  private kind: Kind = "swish";
  private theta = 0.9;
  private vStar = 8;
  private mLo = 0.99;
  private mHi = 1.01;
  private mUsed = 1;
  private mMid = 1;
  private latAng = 0;
  private powerErr = 0;
  private rimTouched = false;
  private boardTouched = false;
  private lastRimSound = 0;
  private target = { x: 0, z: 0 };
  private T = 1;
  private launchT = 0;
  private event = 0;
  private netPulse = 0;
  private scored = false;
  private outcome: ShotOutcome | null = null;
  private resolvedAt = 0;
  private resultSent = false;
  private releaseT = 0;
  private trail: { x: number; y: number; z: number }[] = [];

  // personnages 3D (repli 2D si indisponible)
  private c3: Chars3D | null = null;
  private c3m: C3Mod | null = null;
  private A: { shooter?: Actor; defender?: Actor } = {};
  private lastDt = 0;
  private holdStart = 0;

  attach3D(c3: Chars3D, mod: C3Mod) {
    this.c3 = c3;
    this.c3m = mod;
    if (this.s) this.build3D();
  }

  get use3d() {
    return !!(this.c3 && this.c3.ready && this.A.shooter);
  }

  private build3D() {
    const c3 = this.c3;
    const m = this.c3m;
    if (!c3 || !m || !c3.ready) return;
    c3.clearActors();
    const s = this.s;
    this.A = {};
    this.A.shooter = c3.actor({
      base: "#1d4fd8", collar: "#d81e27", cuff: "#d81e27", shorts: "#1d4fd8", socks: "#f8fafc", boots: "#f8fafc",
      name: s.name, number: String(s.number), numberColor: "#f7d618", numberStroke: "#d81e27", skin: this.body.skin, sleeveless: true, flag: false, female: !!s.female
    });
    if (s.stage.defender) {
      const isMutombo = s.stage.id === 14;
      this.A.defender = c3.actor({
        base: isMutombo ? "#18181b" : "#b91c1c",
        collar: isMutombo ? "#f59e0b" : "#fef2f2",
        cuff: isMutombo ? "#f59e0b" : "#fef2f2",
        shorts: isMutombo ? "#18181b" : "#b91c1c",
        socks: "#f8fafc",
        boots: isMutombo ? "#f59e0b" : "#111827",
        number: isMutombo ? "55" : String(7 + ((s.stage.id * 3) % 90)),
        numberColor: isMutombo ? "#f59e0b" : "#fef2f2",
        numberStroke: isMutombo ? "#000000" : "#7f1d1d",
        skin: this.defBody.skin,
        sleeveless: true
      });
    }
    c3.buildHoop(BOARD_Z, brandImage(LOGO_BL));
    c3.setShadowCenter(this.S.x * 0.5, this.S.z * 0.5);
    this.drive3D();
  }

  /** Pilote les joueurs 3D : dribble (Mixamo), tir en suspension et défense (procéduraux). */
  private drive3D() {
    const m = this.c3m!;
    const B = m.BONE;
    const V = m.THREE.Vector3;
    const sh = this.A.shooter!;
    const yaw = -this.spot.a;
    sh.inPlace = true;
    sh.motionScale = { x: 1, y: 0, z: 1, lift: 0 };
    const t = this.t;
    if (this.phase === "idle") {
      sh.place(this.S.x, this.S.z, yaw);
      const dur = this.c3!.clips.dribble!.duration;
      sh.pose("dribble", t % dur);
    } else {
      // jambes et bras du tir en suspension
      const since = this.phase === "aim" ? -1 : t - this.releaseT;
      const jump = since < 0 ? 0 : 0.38 * Math.sin(clamp(since / 0.62, 0, 1) * Math.PI);
      sh.place(this.S.x, this.S.z, yaw, false, jump);
      sh.pose("catch", 0.02);
      const crouch = since < 0 ? 0.06 + this.power * 0.1 : since < 0.12 ? 0.16 * (1 - since / 0.12) : 0;
      sh.dropHips(crouch);
      const kn = since < 0 ? 0.35 + this.power * 0.3 : 0.15;
      sh.aim(B.lThigh, B.lCalf, new V(0.12, -1, kn));
      sh.aim(B.rThigh, B.rCalf, new V(-0.12, -1, kn));
      sh.aim(B.lCalf, B.lFoot, new V(0.03, -1, -kn * 0.6));
      sh.aim(B.rCalf, B.rFoot, new V(-0.03, -1, -kn * 0.6));
      const ext = since < 0 ? 0 : clamp(since / 0.16, 0, 1);
      const o = this.outcome;
      const after = o ? t - this.resolvedAt - 0.25 : -1;
      if (after > 0 && o) {
        const w = clamp(after / 0.4, 0, 1);
        if (o.scored) {
          // poing levé, puis petits sauts
          sh.place(this.S.x, this.S.z, yaw, false, Math.max(0, Math.sin(after * 6.5)) * 0.18 * w);
          sh.aim(B.rUpper, B.rFore, new V(-0.2, 1, 0.1), w);
          sh.aim(B.rFore, B.rHand, new V(0, 1, 0.05), w);
          sh.aim(B.lUpper, B.lFore, new V(0.45, -0.6, 0.5), w);
          sh.aim(B.lFore, B.lHand, new V(-0.2, 0.5, 1), w);
        } else {
          sh.aim(B.lUpper, B.lFore, new V(0.55, 0.8, 0.15), w);
          sh.aim(B.rUpper, B.rFore, new V(-0.55, 0.8, 0.15), w);
          sh.aim(B.lFore, B.lHand, new V(-0.85, 0.35, 0), w);
          sh.aim(B.rFore, B.rHand, new V(0.85, 0.35, 0), w);
        }
      } else {
        // armé (ballon au-dessus du front) → extension → poignet cassé vers le cercle
        sh.aim(B.lUpper, B.lFore, new V(0.3 - 0.12 * ext, 0.7 + 0.3 * ext, 0.55), 1);
        sh.aim(B.rUpper, B.rFore, new V(-0.3 + 0.12 * ext, 0.7 + 0.3 * ext, 0.55), 1);
        sh.aim(B.lFore, B.lHand, new V(-0.35 * (1 - ext), 1, 0.25 + 0.5 * ext), 1);
        sh.aim(B.rFore, B.rHand, new V(0.35 * (1 - ext), 1, 0.25 + 0.5 * ext), 1);
      }
    }
    // défenseur
    const df = this.A.defender;
    if (df) {
      // Closeout dynamique : se rapproche du tireur quand il arme son tir
      const closeout = this.defT0 < 0 ? 0 : clamp((t - this.defT0) / 0.28, 0, 1);
      const defDist = 1.55 - closeout * 0.38; // passe de 1.55m à 1.17m
      const lateralSway = this.defT0 < 0 ? Math.sin(t * 2.8) * 0.16 : this.perp.x * 0.12 * (1 - closeout);
      const pos = {
        x: this.S.x + this.u.x * defDist + this.perp.x * (0.22 + lateralSway),
        z: this.S.z + this.u.z * defDist + this.perp.z * (0.22 + lateralSway)
      };
      const air = this.defenderAir(t);
      const pre = this.defT0 < 0 ? 9 : this.defJumpAt - t;
      const crouch = pre > 0 && pre < 0.28 ? 1 - pre / 0.28 : 0;
      df.inPlace = true;
      df.place(pos.x, pos.z, yaw + Math.PI, false, air);
      df.pose("catch", 0.02);
      df.dropHips(0.16 + crouch * 0.18);
      df.aim(B.lThigh, B.lCalf, new V(0.28, -0.88, 0.3));
      df.aim(B.rThigh, B.rCalf, new V(-0.28, -0.88, 0.3));
      df.aim(B.lCalf, B.lFoot, new V(0.04, -1, -0.12));
      df.aim(B.rCalf, B.rFoot, new V(-0.04, -1, -0.12));
      const up = clamp(air / 0.22, 0, 1);
      // En l'air : les deux bras se dressent vers le ciel et vers la trajectoire de la balle
      // Au sol : une main active basse, une main haute devant les yeux du tireur
      const handInFace = closeout * (1 - up);
      df.aim(B.lUpper, B.lFore, new V(0.7 - up * 0.65 - handInFace * 0.3, 0.15 + up * 0.82 + handInFace * 0.45, 0.2 + handInFace * 0.25));
      df.aim(B.rUpper, B.rFore, new V(-0.7 + up * 0.65, 0.15 + up * 0.85, 0.25));
      df.aim(B.lFore, B.lHand, new V(0.5 - up * 0.45, 0.5 + up * 0.5 + handInFace * 0.3, 0.2));
      df.aim(B.rFore, B.rHand, new V(-0.5 + up * 0.45, 0.5 + up * 0.5, 0.2));
    }
  }

  constructor(private canvas: HTMLCanvasElement, private cb: EngineCallbacks) {
    this.ctx = canvas.getContext("2d")!;
    this.unsub = onBrandLoad(() => (this.bgDirty = true));
  }

  destroy() {
    this.unsub();
  }

  setup(s: BasketSetup) {
    this.s = s;
    this.rng = mulberry32(s.seed * 17 + s.shot * 4241 + 3);
    const spots = s.stage.spots;
    this.spot = spots[s.shot % spots.length];
    const { d, a } = this.spot;
    this.u = { x: Math.sin(a), z: Math.cos(a) };
    this.perp = { x: Math.cos(a), z: -Math.sin(a) };
    this.S = { x: -this.u.x * d, z: -this.u.z * d };
    this.body = s.female ? FEMALE_BODY : BODIES[(s.number + s.name.length) % BODIES.length];
    this.kit = LEOPARDS_BASKET_KIT(s.name, s.number);
    const isMutombo = s.stage.id === 14;
    const isEliteDef = s.stage.id >= 12;
    const defHeight = isMutombo ? 2.18 : isEliteDef ? 2.08 : 1.98 + Math.max(0, s.stage.id - 4) * 0.01;
    this.defBody = {
      ...BODIES[(s.shot + 3) % BODIES.length],
      height: defHeight,
      headband: isMutombo ? "#111827" : "#fef2f2"
    };
    this.phase = "idle";
    this.phaseT = 0;
    this.touch = null;
    this.power = 0;
    this.aimX = 0;
    this.held = true;
    this.outcome = null;
    this.resultSent = false;
    this.scored = false;
    this.netPulse = 0;
    this.parts = [];
    this.trail = [];
    this.defT0 = -1;
    this.defJumpAt = 99;
    this.event = 0;
    // zone verte : plus loin = plus de puissance, plus étroite
    this.ideal = 0.5 + ((d - 4.6) / 4.6) * 0.32 + (this.rng() - 0.5) * 0.04;
    this.windowW = s.stage.window * s.diff.window;
    this.bgDirty = true;
    this.layout();
    this.calibrate();
    if (this.c3?.ready) this.build3D();
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.bgDirty = true;
    if (this.s) this.layout();
  }

  private layout() {
    const cam = this.cam;
    const back = 7;
    const side = 1.35;
    cam.x = this.S.x - this.u.x * back + this.perp.x * side;
    cam.z = this.S.z - this.u.z * back + this.perp.z * side;
    cam.y = 3.3;
    cam.setYaw(Math.atan2(0 - cam.x, 0 - cam.z));
    const [, rzRim] = cam.rel(0, 0);
    const [, rzS] = cam.rel(this.S.x, this.S.z);
    const vRimTop = -(RIM_Y + 0.9 - cam.y) / rzRim;
    const vFeet = cam.y / rzS;
    const portrait = this.h > this.w;
    cam.f = (this.h * (portrait ? 0.6 : 0.7)) / (vFeet - vRimTop);
    cam.hz = this.h * (portrait ? 0.93 : 0.96) - vFeet * cam.f;
    cam.cx = this.w / 2 + (portrait ? this.w * 0.1 : 0);
  }

  /* ---------------- Décor ---------------- */

  private renderBackground() {
    const W = this.w;
    const H = this.h;
    if (!this.bg) this.bg = document.createElement("canvas");
    this.bg.width = Math.round(W * this.dpr);
    this.bg.height = Math.round(H * this.dpr);
    const ctx = this.bg.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.s.stage.venue === "arena") this.drawArena(ctx, W, H);
    else this.drawStreet(ctx, W, H);
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    this.bgDirty = false;
  }

  /* --- outils de dessin au sol --- */
  private floorPoly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string, stroke?: string, lw = 0.06) {
    const cam = this.cam;
    // découpe au plan proche (évite les polygones dégénérés derrière la caméra)
    const NEAR = 0.5;
    const rel = pts.map(([x, z]) => {
      const [rx, rz] = cam.rel(x, z);
      return { rx, rz };
    });
    const closed = !!fill;
    const out: { rx: number; rz: number }[] = [];
    const n = rel.length;
    for (let i = 0; i < n; i++) {
      const a = rel[i];
      const b = rel[(i + 1) % n];
      const aIn = a.rz >= NEAR;
      const bIn = b.rz >= NEAR;
      if (aIn) out.push(a);
      if ((aIn !== bIn) && (closed || i < n - 1)) {
        const t = (NEAR - a.rz) / (b.rz - a.rz);
        out.push({ rx: a.rx + (b.rx - a.rx) * t, rz: NEAR });
      }
      if (!closed && i === n - 1 && !aIn) break;
    }
    if (out.length < 2) return;
    ctx.beginPath();
    out.forEach((q, i) => {
      const s = cam.f / q.rz;
      const x = cam.cx + q.rx * s;
      const y = cam.hz + cam.y * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (fill) {
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      const mid = cam.p(0, 0, -4);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.2, lw * mid.s);
      ctx.stroke();
    }
  }

  private floorText(ctx: CanvasRenderingContext2D, text: string, cx: number, cz: number, size: number, color: string, maxW: number) {
    const cam = this.cam;
    const o = cam.p(cx, 0, cz);
    if (o.z < 0.6) return;
    const px = cam.p(cx + 1, 0, cz);
    const pz = cam.p(cx, 0, cz + 1);
    const d = this.dpr;
    ctx.save();
    ctx.setTransform(d * (px.x - o.x), d * (px.y - o.y), -d * (pz.x - o.x), -d * (pz.y - o.y), d * o.x, d * o.y);
    ctx.scale(0.01, 0.01);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(size * 100)}px 'Bebas Neue', Anton, sans-serif`;
    ctx.fillText(text, 0, 0, maxW * 100);
    ctx.restore();
  }

  private wallQuad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, z: number, fill: string | CanvasGradient) {
    const cam = this.cam;
    const a = cam.p(x0, y1, z);
    const b = cam.p(x1, y1, z);
    const c = cam.p(x1, y0, z);
    const d = cam.p(x0, y0, z);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    return { a, b, c, d };
  }

  /** Lignes FIBA d'un demi-terrain (raquette, demi-cercle, ligne à 3 points). */
  private courtLines(ctx: CanvasRenderingContext2D, baseZ: number, keyFill: string, ftCircleFill?: string) {
    if (keyFill) this.floorPoly(ctx, [[-2.45, baseZ], [2.45, baseZ], [2.45, baseZ - 5.8], [-2.45, baseZ - 5.8]], keyFill);
    const arc: [number, number][] = [];
    for (let k = 0; k <= 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      arc.push([Math.cos(a) * 1.8, baseZ - 5.8 + Math.sin(a) * 1.8]);
    }
    if (ftCircleFill) this.floorPoly(ctx, arc, ftCircleFill);
    this.floorPoly(ctx, [[-2.45, baseZ], [2.45, baseZ], [2.45, baseZ - 5.8], [-2.45, baseZ - 5.8], [-2.45, baseZ]], "", "#ffffff");
    this.floorPoly(ctx, arc.filter(([, z]) => z <= baseZ - 5.8 + 0.01), "", "#ffffff");
    const three: [number, number][] = [[-6.6, baseZ]];
    const a0 = Math.acos(6.6 / 6.75);
    for (let k = 0; k <= 40; k++) {
      const a = -a0 - (k / 40) * (Math.PI - 2 * a0);
      three.push([-Math.cos(a) * 6.75, Math.sin(a) * 6.75]);
    }
    three.push([6.6, baseZ]);
    this.floorPoly(ctx, three, "", "#ffffff");
    this.floorPoly(ctx, [[-7.5, baseZ], [7.5, baseZ]], "", "#ffffff");
    this.floorPoly(ctx, [[-7.5, baseZ], [-7.5, -14]], "", "#ffffff");
    this.floorPoly(ctx, [[7.5, baseZ], [7.5, -14]], "", "#ffffff");
    // position du tireur
    const sp = this.cam.p(this.S.x, 0, this.S.z);
    ctx.fillStyle = "rgba(244,196,0,0.9)";
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, 0.45 * sp.s, 0.12 * sp.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Playground extérieur : sol vert, zones peintes orange et bleu ciel, piliers colorés, murs graffés. */
  private drawStreet(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const cam = this.cam;
    const rng = mulberry32(11);
    const baseZ = BOARD_Z + 1.2;

    // ciel couvert de fin d'après-midi
    const sky = ctx.createLinearGradient(0, 0, 0, cam.hz);
    sky.addColorStop(0, "#475569");
    sky.addColorStop(0.6, "#94a3b8");
    sky.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const cx = rng() * W;
      const cy = rng() * cam.hz * 0.7;
      const r = 40 + rng() * 90;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      g.addColorStop(0, "rgba(241,245,249,0.45)");
      g.addColorStop(1, "rgba(241,245,249,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // tour colorée en mosaïque + entrepôts au loin
    for (let i = 0; i < 6; i++) {
      const x0 = -26 + i * 9 + rng() * 3;
      const hgt = 5 + rng() * 6;
      this.wallQuad(ctx, x0, 0, x0 + 7 + rng() * 3, hgt, 34, i % 2 ? "#6b7280" : "#78716c");
    }
    const tiles = ["#dc2626", "#2563eb", "#facc15", "#16a34a", "#f8fafc", "#f97316", "#7c3aed"];
    for (let ty = 0; ty < 12; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        this.wallQuad(ctx, 9 + tx * 1.5, 8 + ty * 1.6, 10.5 + tx * 1.5, 9.6 + ty * 1.6, 30, tiles[(tx * 3 + ty * 5) % tiles.length]);
      }
    }
    this.wallQuad(ctx, 9, 0, 15, 8, 30, "#57534e");

    // passerelle en béton sur piliers colorés
    const beamZ = 9;
    this.wallQuad(ctx, -30, 6.6, 30, 7.6, beamZ, "#a8a29e");
    this.wallQuad(ctx, -30, 7.6, 30, 8.2, beamZ, "#78716c");
    const pillar = (x: number, z: number, color: string) => {
      const g = cam.p(x, 0, z);
      const t = cam.p(x, 6.6, z);
      const w = 0.55 * g.s;
      ctx.fillStyle = color;
      ctx.fillRect(g.x - w, t.y, w * 2, g.y - t.y);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(g.x + w * 0.35, t.y, w * 0.65, g.y - t.y);
      ctx.fillStyle = color;
      ctx.fillRect(g.x - w * 1.6, t.y - 0.5 * g.s, w * 3.2, 0.7 * g.s);
    };
    pillar(-8, beamZ, "#f97316");
    pillar(-14, beamZ, "#facc15");
    pillar(8.5, beamZ, "#93c5fd");
    pillar(15, beamZ, "#16a34a");

    // mur graffé derrière le panier
    const wallZ = 4.2;
    this.wallQuad(ctx, -12, 0, 12, 3.4, wallZ, "#27272a");
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x0 = -11 + rng() * 22;
      const y0 = 0.6 + rng() * 2.4;
      const a = cam.p(x0, y0, wallZ);
      const b = cam.p(x0 + 0.6 + rng() * 1.6, y0 + (rng() - 0.5) * 1.2, wallZ);
      ctx.strokeStyle = ["#f97316", "#38bdf8", "#facc15", "#f472b6", "#a3e635", "#f8fafc"][i % 6];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = (0.12 + rng() * 0.16) * a.s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 0.6 * a.s, b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    // fresques des deux marques
    const muralImg = (src: string, cx: number, w: number, y0: number, y1: number) => {
      const img = brandImage(src);
      if (!img) return;
      const a = cam.p(cx - w / 2, y1, wallZ - 0.01);
      const b = cam.p(cx + w / 2, y0, wallZ - 0.01);
      const bw = b.x - a.x;
      const bh = b.y - a.y;
      const ratio = img.naturalWidth / img.naturalHeight;
      let dw = bw;
      let dh = bw / ratio;
      if (dh > bh) {
        dh = bh;
        dw = bh * ratio;
      }
      ctx.drawImage(img, a.x + (bw - dw) / 2, a.y + (bh - dh) / 2, dw, dh);
    };
    muralImg(LOGO_BL, -4.6, 3.2, 1, 3.3);
    muralImg(LOGO_RDC, 5, 4.6, 1.4, 2.8);
    // bandeau partenaires
    for (let i = 0; i < 16; i++) {
      const x0 = -12 + i * 1.5;
      const a = cam.p(x0, 0.85, wallZ - 0.02);
      const b = cam.p(x0 + 1.5, 0.3, wallZ - 0.02);
      if (b.x < 0 || a.x > W) continue;
      drawPartnerPanel(ctx, a.x, a.y, b.x - a.x, b.y - a.y, i);
    }
    // grillage
    ctx.strokeStyle = "rgba(15,23,42,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = -16; gx <= 16; gx += 0.5) {
      const a = cam.p(gx, 3.4, wallZ - 0.4);
      const b = cam.p(gx + 1.2, 6, wallZ - 0.4);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const c = cam.p(gx + 1.2, 3.4, wallZ - 0.4);
      const d = cam.p(gx, 6, wallZ - 0.4);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
    }
    ctx.stroke();

    // sol : béton autour, terrain vert, grandes zones peintes
    const floorTop = cam.p(0, 0, wallZ).y;
    ctx.fillStyle = "#a8a29e";
    ctx.fillRect(0, floorTop, W, H - floorTop);
    this.floorPoly(ctx, [[-8.5, wallZ - 0.5], [8.5, wallZ - 0.5], [8.5, -16], [-8.5, -16]], "#1d6b52");
    this.floorPoly(ctx, [[-7.5, baseZ], [7.5, baseZ], [7.5, -16], [-7.5, -16]], "#237a5d");
    this.floorPoly(ctx, [[-4.6, baseZ], [4.9, baseZ], [6.2, -0.8], [5.1, -4.4], [2.2, -6.9], [-1.6, -6.4], [-4.9, -4.6], [-6.2, -1.6]], "#e8743b");
    this.floorPoly(ctx, [[1.4, -7.6], [5.6, -6.2], [7.5, -8.4], [7.5, -12.5], [3.4, -13.2], [0.2, -10.6]], "#9cc3e6");
    this.floorPoly(ctx, [[-7.5, -9.5], [-3.2, -8.6], [-1.8, -11.8], [-5.2, -14], [-7.5, -13.2]], "#e8743b");
    for (let i = 0; i < 320; i++) {
      const px = (rng() - 0.5) * 17;
      const pz = baseZ - rng() * 17;
      const [, rz] = cam.rel(px, pz);
      if (rz < 0.5) continue;
      const p = cam.p(px, 0, pz);
      ctx.fillStyle = rng() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(p.x, p.y, 2, 1);
    }
    this.courtLines(ctx, baseZ, "");

    // poteau de rue
    const pole = cam.p(0, 0, BOARD_Z + 1.3);
    const poleTop = cam.p(0, 3.5, BOARD_Z + 1.3);
    ctx.fillStyle = "#111827";
    ctx.fillRect(pole.x - 0.08 * pole.s, poleTop.y, 0.16 * pole.s, pole.y - poleTop.y);
    const arm = cam.p(0, 3.35, BOARD_Z + 0.05);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 0.09 * arm.s;
    ctx.beginPath();
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(arm.x, arm.y);
    ctx.stroke();
  }

  /** Salle de Kinshasa : parquet, bordure bleue « KINSHASA · CONGO DR », ronds bleus, tribunes rouges. */
  private drawArena(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const cam = this.cam;
    const rng = mulberry32(5);
    const baseZ = BOARD_Z + 1.2;

    // plafond et rampes lumineuses
    const top = ctx.createLinearGradient(0, 0, 0, cam.hz);
    top.addColorStop(0, "#020617");
    top.addColorStop(1, "#111827");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H);
    for (let i = -3; i <= 3; i++) {
      const p = cam.p(i * 5, 16, 18);
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 60);
      g.addColorStop(0, "rgba(255,255,240,0.9)");
      g.addColorStop(0.2, "rgba(255,250,220,0.25)");
      g.addColorStop(1, "rgba(255,250,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 60, p.y - 60, 120, 120);
    }

    // tribunes : rangées de sièges rouges qui montent derrière la ligne de fond
    const rows = 24;
    for (let r = rows - 1; r >= 0; r--) {
      const z = baseZ + 4.2 + r * 0.85;
      const y = 0.9 + r * 0.5;
      const a = cam.p(-20, y + 0.5, z);
      const b = cam.p(20, y, z);
      ctx.fillStyle = r % 2 ? "#991b1b" : "#b91c1c";
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y + 1);
      const seat = 0.55 * b.s;
      if (seat > 3) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        for (let x = a.x; x < b.x; x += seat) ctx.fillRect(x, a.y + (b.y - a.y) * 0.2, seat * 0.7, (b.y - a.y) * 0.35);
      }
      // quelques supporters
      for (let k = 0; k < 14; k++) {
        if (rng() > 0.55) continue;
        const sx = -18 + rng() * 36;
        const sp = cam.p(sx, y + 0.25, z);
        ctx.fillStyle = ["#1466E0", "#F4C400", "#f8fafc", "#1466E0"][k % 4];
        ctx.fillRect(sp.x - 0.22 * sp.s, sp.y - 0.25 * sp.s, 0.44 * sp.s, 0.5 * sp.s);
        ctx.fillStyle = "#4a2c1a";
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - 0.38 * sp.s, 0.12 * sp.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // muret + panneaux LED le long de la ligne de fond
    this.wallQuad(ctx, -22, 0, 22, 0.95, baseZ + 4.1, "#1f2937");
    const ledZ = baseZ + 2.6;
    for (let i = -6; i <= 6; i++) {
      const x0 = i * 3 - 1.5;
      const a = cam.p(x0, 0.9, ledZ);
      const b = cam.p(x0 + 3, 0, ledZ);
      if (b.x < -10 || a.x > W + 10) continue;
      const ai = Math.abs(i);
      if (i === 0 || ai === 3) drawBrandPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, "bl", "#060b1a");
      else if (ai === 1 || ai === 5) drawBrandPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, "rdc", "#060b1a");
      else drawPartnerPanel(ctx, a.x, a.y, b.x - a.x + 0.5, b.y - a.y, i + 6);
    }

    // sol : bordure bleue, parquet
    const floorTop = cam.p(0, 0, ledZ).y;
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(0, floorTop, W, H - floorTop);
    const wood = ctx.createLinearGradient(0, cam.p(0, 0, baseZ).y, 0, H);
    wood.addColorStop(0, "#c98a45");
    wood.addColorStop(1, "#e0a862");
    this.floorPoly(ctx, [[-7.5, baseZ], [7.5, baseZ], [7.5, -16], [-7.5, -16]], "#d39a52");
    ctx.fillStyle = wood;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    // lames de parquet
    ctx.strokeStyle = "rgba(120,62,18,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -7.5; x <= 7.5; x += 0.25) {
      const a = cam.p(x, 0, baseZ);
      const zEnd = Math.max(-16, cam.z + 1.2);
      const b = cam.p(x, 0, zEnd);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    for (let i = 0; i < 260; i++) {
      const px = -7.5 + Math.floor(rng() * 60) * 0.25;
      const pz = baseZ - rng() * 16;
      const [, rz] = cam.rel(px, pz);
      if (rz < 0.6) continue;
      const a = cam.p(px, 0, pz);
      const b = cam.p(px + 0.25, 0, pz);
      ctx.strokeStyle = "rgba(120,62,18,0.22)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // inscriptions au sol derrière la ligne de fond
    this.floorText(ctx, "KINSHASA", -4.2, baseZ + 1.2, 1.1, "#f8fafc", 6.5);
    this.floorText(ctx, "CONGO DR", 4.2, baseZ + 1.2, 1.1, "#f8fafc", 6.5);
    this.courtLines(ctx, baseZ, "", "#3b82f6");
    // rond central bleu (au loin derrière le tireur, parfois visible)
    const mid: [number, number][] = [];
    for (let k = 0; k <= 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      mid.push([Math.cos(a) * 1.8, baseZ - 14 + Math.sin(a) * 1.8]);
    }
    this.floorPoly(ctx, mid, "#3b82f6", "#ffffff");
    // reflets du parquet
    const shine = ctx.createLinearGradient(0, floorTop, 0, H);
    shine.addColorStop(0, "rgba(255,255,255,0.10)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, floorTop, W, H - floorTop);

    // support de panier mobile (embase bleue rembourrée)
    const zb = baseZ + 1.4;
    this.wallQuad(ctx, -0.8, 0, 0.8, 1.05, zb, "#1e3a8a");
    this.wallQuad(ctx, -0.8, 0.85, 0.8, 1.05, zb - 0.01, "#2563eb");
    const base = cam.p(0, 1.05, zb);
    const arm = cam.p(0, 3.6, BOARD_Z + 0.05);
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 0.18 * base.s;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(arm.x, arm.y);
    ctx.stroke();
  }

  /* ---------------- Geste ---------------- */

  down(x: number, y: number) {
    audio.unlock();
    if (this.phase !== "idle") return;
    this.touch = { x0: x, y0: y, x, y, t0: this.t };
    this.phase = "aim";
    this.phaseT = 0;
    this.power = 0;
    this.holdStart = this.t;
    if (this.s.stage.defender && this.defT0 < 0) {
      this.defT0 = this.t;
      this.defJumpAt = this.t + this.s.stage.defenderJump * (this.s.diff.id === "facile" ? 1.4 : this.s.diff.id === "legende" ? 0.82 : 1);
    }
    this.cb.onAim?.(true);
  }

  move(x: number, y: number) {
    if (!this.touch) return;
    this.touch.x = x;
    this.touch.y = y;
    // la puissance ne se règle plus au doigt : seule la visée suit le geste
    this.aimX = clamp((x - this.touch.x0) / (this.w * 0.45), -1, 1);
  }

  /** Durée de montée de la jauge : plus courte de loin et en difficulté élevée. */
  private get fillTime() {
    const base = this.s.diff.id === "facile" ? 1.15 : this.s.diff.id === "legende" ? 0.66 : 0.84;
    return base * (1 - (this.spot.d - 4.6) * 0.035) * (this.s.stage.defender ? 0.94 : 1);
  }

  up(x: number, y: number) {
    if (!this.touch) return;
    this.move(x, y);
    this.releaseNow();
  }

  /** Lâcher du ballon : la puissance est celle de la jauge à cet instant précis. */
  private releaseNow() {
    if (!this.touch) return;
    this.touch = null;
    this.cb.onAim?.(false);
    if (this.power < 0.06) {
      this.phase = "idle";
      return;
    }
    this.phase = "release";
    this.phaseT = 0;
    this.releaseT = this.t;
    this.planShot();
    this.cb.onKick();
  }

  cancel() {
    this.touch = null;
    if (this.phase === "aim") this.phase = "idle";
    this.cb.onAim?.(false);
  }

  skip() {
    if (this.outcome && !this.resultSent && this.t - this.resolvedAt > 0.35) this.resolvedAt = -99;
  }

  timeout(): boolean {
    if (this.phase === "release" || this.phase === "flight" || this.phase === "done") return false;
    this.touch = null;
    this.phase = "done";
    audio.buzzer();
    this.outcome = { scored: false, base: 0, tags: ["timeout"], label: "24 secondes !", detail: "La possession est perdue", zone: 0 };
    this.resolvedAt = this.t - 0.4;
    return true;
  }

  /** Jauge visible par le shell (HUD) — non utilisée en interne. */
  get gauge() {
    return { power: this.power, ideal: this.ideal, window: this.windowW, aiming: this.phase === "aim" };
  }

  private get defenderJumpHeight(): number {
    const id = this.s.stage.id;
    if (id === 14) return 0.78; // Mutombo
    if (id >= 12) return 0.68;
    if (id >= 8) return 0.60;
    return 0.48 + Math.max(0, id - 4) * 0.015;
  }

  private defenderAir(t: number): number {
    if (!this.s.stage.defender || t < this.defJumpAt) return 0;
    const dt = t - this.defJumpAt;
    const dur = 0.74;
    // Premier saut de contestation explosif
    if (dt < dur) {
      const k = dt / dur;
      return Math.sin(k * Math.PI) * this.defenderJumpHeight;
    }
    // Phase d'atterrissage et reprise d'appuis (feinte de tir réussie)
    const recovery = 0.62;
    if (dt < dur + recovery) return 0;
    // Deuxième impulsion si le tireur garde la balle trop longtemps
    const dt2 = dt - (dur + recovery);
    if (dt2 < dur * 0.8) {
      const k2 = dt2 / (dur * 0.8);
      return Math.sin(k2 * Math.PI) * (this.defenderJumpHeight * 0.72);
    }
    return 0;
  }

  /* ---------------- Physique réelle du tir ---------------- */

  /** Point de lâcher du ballon (au-dessus de la tête, saut compris). */
  private releasePoint() {
    return { x: this.S.x + this.u.x * 0.32 + this.perp.x * 0.12, y: 2.78, z: this.S.z + this.u.z * 0.32 + this.perp.z * 0.12 };
  }

  /** Vitesse initiale pour une puissance relative m et une déviation latérale (rad). */
  private launchVel(m: number, latAng: number) {
    const th = this.theta;
    const sp = this.vStar * m;
    // direction horizontale : du point de lâcher vers le centre du cercle
    const P = this.releasePoint();
    const l = Math.hypot(P.x, P.z) || 1;
    const ux = -P.x / l;
    const uz = -P.z / l;
    const c = Math.cos(latAng);
    const sn = Math.sin(latAng);
    const hx = ux * c + uz * sn;
    const hz = uz * c - ux * sn;
    return { x: hx * sp * Math.cos(th), y: sp * Math.sin(th), z: hz * sp * Math.cos(th) };
  }

  /** Simulation complète (cercle, planche, filet) : renvoie si le ballon rentre. */
  private simulate(v0: { x: number; y: number; z: number }, collide = true): { made: boolean; crossD: number; swish?: boolean } {
    const P = this.releasePoint();
    const st = { x: P.x, y: P.y, z: P.z, vx: v0.x, vy: v0.y, vz: v0.z, rim: false, board: false };
    const dt = 1 / 240;
    let crossD = 99;
    for (let i = 0; i < 900; i++) {
      const prevY = st.y;
      this.integrate(st, dt, collide);
      if (prevY >= RIM_Y && st.y < RIM_Y && st.vy < 0) {
        const hl = Math.hypot(st.x, st.z);
        crossD = hl;
        if (hl < RIM_R - R * 0.3) return { made: true, crossD, swish: !st.rim && !st.board };
        if (!collide) return { made: false, crossD };
      }
      if (st.y < 1.5) break;
    }
    return { made: false, crossD };
  }

  /** Un pas physique : gravité, traînée, cercle (tore), planche. Modifie l'état. */
  private integrate(st: { x: number; y: number; z: number; vx: number; vy: number; vz: number; rim: boolean; board: boolean }, dt: number, collide: boolean) {
    const sp = Math.hypot(st.vx, st.vy, st.vz);
    const kd = 0.016;
    st.vx -= kd * sp * st.vx * dt;
    st.vy -= (G + kd * sp * st.vy) * dt;
    st.vz -= kd * sp * st.vz * dt;
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    st.z += st.vz * dt;
    if (!collide) return;
    // cercle : tore de rayon RIM_R, tube 9 mm
    const hl = Math.hypot(st.x, st.z) || 1e-6;
    const qx = (st.x / hl) * RIM_R;
    const qz = (st.z / hl) * RIM_R;
    const dx = st.x - qx;
    const dy = st.y - RIM_Y;
    const dz = st.z - qz;
    const dist = Math.hypot(dx, dy, dz);
    const minD = R + 0.009;
    if (dist < minD) {
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      st.x = qx + nx * minD;
      st.y = RIM_Y + ny * minD;
      st.z = qz + nz * minD;
      const vn = st.vx * nx + st.vy * ny + st.vz * nz;
      if (vn < 0) {
        const e = 0.58;
        st.vx -= (1 + e) * vn * nx;
        st.vy -= (1 + e) * vn * ny;
        st.vz -= (1 + e) * vn * nz;
        st.vx *= 0.9;
        st.vz *= 0.9;
        st.rim = true;
      }
    }
    // planche (face avant)
    if (st.z + R > BOARD_Z && st.z < BOARD_Z + 0.1 && Math.abs(st.x) < 0.9 && st.y > 2.9 && st.y < 3.95 && st.vz > 0) {
      st.z = BOARD_Z - R;
      st.vz = -st.vz * 0.62;
      st.vx *= 0.92;
      st.board = true;
    }
  }

  /** Calibre la vitesse idéale et la plage de puissance qui rentre vraiment (zone verte = paniers). */
  private calibrate() {
    const P = this.releasePoint();
    const d = Math.hypot(P.x, P.z);
    this.theta = (50 + Math.min(4, (d - 4.6) * 0.8)) * (Math.PI / 180);
    // vitesse qui amène le ballon au centre du cercle (sans collision), par dichotomie
    let lo = 4;
    let hi = 15;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (this.crossSigned(mid) < 0.03) lo = mid;
      else hi = mid;
    }
    this.vStar = (lo + hi) / 2;
    // plage de réussite réelle autour de m = 1
    let mLo = 1;
    let mHi = 1;
    // recherche fine du premier panier autour de m = 1, puis des bornes
    let seed = 0;
    for (let k = 0; k <= 60 && !seed; k++) {
      for (const m of [1 + k * 0.0005, 1 - k * 0.0005]) {
        if (this.simulate(this.launchVel(m, 0)).made) {
          seed = m;
          break;
        }
      }
    }
    if (!seed) seed = 1;
    mLo = seed;
    mHi = seed;
    for (let m = seed; m > seed - 0.06; m -= 0.0005) {
      if (this.simulate(this.launchVel(m, 0)).made) mLo = m;
      else break;
    }
    for (let m = seed; m < seed + 0.06; m += 0.0005) {
      if (this.simulate(this.launchVel(m, 0)).made) mHi = m;
      else break;
    }
    // centre de la zone verte : le milieu des « swish » s'il y en a
    let sLo = 0;
    let sHi = 0;
    for (let m = mLo; m <= mHi + 1e-6; m += 0.0005) {
      const r = this.simulate(this.launchVel(m, 0));
      if (r.made && r.swish) {
        if (!sLo) sLo = m;
        sHi = m;
      }
    }
    this.mLo = mLo;
    this.mHi = mHi;
    this.mMid = sLo ? (sLo + sHi) / 2 : (mLo + mHi) / 2;
  }

  /** Distance signée (le long de l'axe de tir) au centre du cercle quand le ballon redescend au niveau du cercle. */
  private crossSigned(speed: number) {
    const keep = this.vStar;
    this.vStar = speed;
    const v = this.launchVel(1, 0);
    this.vStar = keep;
    const P = this.releasePoint();
    const st = { x: P.x, y: P.y, z: P.z, vx: v.x, vy: v.y, vz: v.z, rim: false, board: false };
    for (let i = 0; i < 900; i++) {
      const prevY = st.y;
      this.integrate(st, 1 / 240, false);
      if (prevY >= RIM_Y && st.y < RIM_Y && st.vy < 0) {
        const l = Math.hypot(P.x, P.z) || 1;
        return (st.x * -P.x + st.z * -P.z) / l;
      }
      if (st.y < 0) break;
    }
    return -9;
  }

  private planShot() {
    const s = this.s;
    const diff = s.diff;
    // Détection physique du contre (Block)
    if (s.stage.defender) {
      const airAtRelease = this.defenderAir(this.t + 0.1);
      const isPeakJump = airAtRelease > 0.28;
      const isPerfectGreen = Math.abs(this.power - this.ideal) < this.windowW * 0.45;
      if (isPeakJump) {
        // En pleine extension : un tir parfait passe au-dessus, un tir moyen est rejeté
        const blockChance = isPerfectGreen ? 0.22 : 0.85;
        if (this.rng() < blockChance) {
          this.kind = "block";
          return;
        }
      }
    }
    this.kind = "swish";
    const e = clamp((this.power - this.ideal) / this.windowW, -4, 4);
    // e = ±1 : bords de la zone verte = limites réelles des paniers
    const span = e < 0 ? this.mMid - this.mLo : this.mHi - this.mMid;
    this.mUsed = this.mMid + e * span * 0.95 + gauss(this.rng) * 0.0025 * diff.aimNoise;
    this.latAng = this.aimX * (diff.assist ? 0.035 : 0.075) + gauss(this.rng) * 0.006 * diff.aimNoise;
    this.powerErr = e;
  }

  private launch() {
    const P = this.releasePoint();
    this.bx = P.x;
    this.by = P.y;
    this.bz = P.z;
    this.held = false;
    this.rimTouched = false;
    this.boardTouched = false;
    if (this.kind === "block") {
      this.vx = this.perp.x * (2.8 + this.rng() * 1.5) + (this.rng() - 0.5) * 1.6;
      this.vz = -this.u.z * (1.8 + this.rng() * 0.8);
      this.vy = 4.3;
      this.spin = (this.rng() - 0.5) * 14;
      audio.glove();
      const defName = this.s.stage.id === 14 ? "Dikembe Mutombo" : this.s.stage.id >= 12 ? "Le Pivot d'Élite" : "Le Défenseur";
      this.resolve(false, "REJETÉ ! (BLOC)", `${defName} claque ton tir en plein vol ! Feinte ou shoote plus vite.`, ["block"]);
    } else {
      const v = this.launchVel(this.mUsed, this.latAng);
      this.vx = v.x;
      this.vy = v.y;
      this.vz = v.z;
    }
    this.launchT = this.t;
    this.phase = "flight";
    this.event = 0;
    audio.bounce(0.3);
  }

  private shooterSkeleton() {
    return skeleton(this.shooterPose(), this.body);
  }

  private handsWorld(sk: ReturnType<typeof skeleton>) {
    const lx = (sk.haL.x + sk.haR.x) / 2;
    const ly = (sk.haL.y + sk.haR.y) / 2 + 0.1;
    // le personnage est dessiné face au panier : son axe latéral local = perp
    return {
      x: this.S.x + this.perp.x * lx + this.u.x * 0.25,
      y: ly,
      z: this.S.z + this.perp.z * lx + this.u.z * 0.25
    };
  }

  private shooterPose(): Pose {
    const t = this.t;
    if (this.phase === "idle") {
      const d = Math.sin(t * 6);
      return { ...POSES.hoopDribble, elR: POSES.hoopDribble.elR + d * 0.25, air: 0 };
    }
    if (this.phase === "aim") {
      const k = easeOutCubic(this.phaseT / 0.16);
      const p = lerpPose(POSES.hoopGather, POSES.hoopSet, k);
      return { ...p, knL: p.knL + this.power * 0.25, knR: p.knR - this.power * 0.25, hipL: p.hipL - this.power * 0.1, hipR: p.hipR + this.power * 0.1 };
    }
    const since = t - this.releaseT;
    if (since < 0.16) return lerpPose(POSES.hoopSet, POSES.hoopRelease, easeOutCubic(since / 0.16));
    if (since < 0.5) return POSES.hoopRelease;
    let p = lerpPose(POSES.hoopRelease, POSES.hoopLand, easeInOut((since - 0.5) / 0.25));
    if (this.outcome && t - this.resolvedAt > 0.2) {
      const r = easeInOut((t - this.resolvedAt - 0.2) / 0.4);
      p = lerpPose(p, this.outcome.scored ? POSES.shooterCheer : POSES.shooterSad, r);
      if (this.outcome.scored && !this.s.reduced) p = { ...p, air: Math.abs(Math.sin((t - this.resolvedAt) * 7)) * 0.1 * r };
    }
    return p;
  }

  /* ---------------- Boucle ---------------- */

  update(dt: number) {
    if (!this.s) return;
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    this.phaseT += dt;
    this.lastDt = dt;
    // jauge de tir : monte toute seule pendant l'appui (accélère en fin de course)
    if (this.phase === "aim" && this.touch) {
      const k = (this.t - this.holdStart) / this.fillTime;
      this.power = 1.15 * Math.pow(Math.max(0, k), 1.35);
      if (this.power >= 1.15) {
        this.power = 1.15;
        this.releaseNow();
      }
    }
    if (this.phase === "release" && this.t - this.releaseT > 0.14) this.launch();
    if (this.use3d) this.drive3D();
    if (this.phase === "flight" || (this.phase === "done" && !this.held)) {
      const n = 4;
      for (let i = 0; i < n; i++) this.step(dt / n);
      this.spin -= dt * 9;
      if (!this.s.reduced && this.phase === "flight") {
        this.trail.push({ x: this.bx, y: this.by, z: this.bz });
        if (this.trail.length > 6) this.trail.shift();
      }
    }
    if (this.outcome && !this.resultSent && this.t - this.resolvedAt > (this.s.fast ? 0.85 : 1.5)) {
      this.resultSent = true;
      this.cb.onResult(this.outcome);
    }
    this.netPulse = Math.max(0, this.netPulse - dt * 2.2);
    updateParticles(this.parts, dt);
  }

  private step(dt: number) {
    const since = this.t - this.launchT;
    const st = { x: this.bx, y: this.by, z: this.bz, vx: this.vx, vy: this.vy, vz: this.vz, rim: false, board: false };
    const prevY = this.by;
    this.integrate(st, dt, this.kind !== "block");
    if (st.rim && this.t - this.lastRimSound > 0.08) {
      audio.rim();
      this.lastRimSound = this.t;
      this.netPulse = Math.max(this.netPulse, 0.25);
    }
    if (st.board && !this.boardTouched) audio.bounce(0.6);
    this.rimTouched ||= st.rim;
    this.boardTouched ||= st.board;
    this.bx = st.x;
    this.by = st.y;
    this.bz = st.z;
    this.vx = st.vx;
    this.vy = st.vy;
    this.vz = st.vz;

    // panier : le ballon traverse le cercle vers le bas
    if (!this.outcome && this.kind !== "block" && prevY >= RIM_Y && this.by < RIM_Y && this.vy < 0) {
      const hl = Math.hypot(this.bx, this.bz);
      if (hl < RIM_R - R * 0.3) {
        if (!this.rimTouched && !this.boardTouched) this.made("Swish !", "Ficelle, rien que le filet", ["swish"]);
        else if (this.boardTouched && !this.rimTouched) this.made("Avec la planche !", "Tir de vieux briscard", ["bank"]);
        else this.made("Panier !", "Ça a tremblé sur le cercle", ["rim-in"]);
      }
    }
    // filet : freine et recentre le ballon qui tombe
    if (this.scored && this.by < RIM_Y && this.by > RIM_Y - 0.5) {
      this.vx *= 0.88;
      this.vz *= 0.88;
      this.vy = Math.max(this.vy, -3.2);
      this.bx *= 0.94;
      this.bz *= 0.94;
    }
    // raté : le ballon redescend sous le cercle sans être passé dedans
    if (!this.outcome && this.kind !== "block" && (this.by < RIM_Y - 0.9 || since > 3.2)) {
      const tooStrong = this.powerErr > 0;
      if (this.rimTouched) this.resolve(false, "Sur le cercle", tooStrong ? "Un poil trop fort" : "Un poil trop court", ["rim"]);
      else if (this.boardTouched) this.resolve(false, "Planche", "Trop fort : relâche plus tôt", ["board"]);
      else if (Math.abs(this.latAng) > 0.03 && Math.abs(this.powerErr) < 1.5) this.resolve(false, "À côté", "Garde ton geste bien droit", ["wide"]);
      else this.resolve(false, tooStrong ? "Trop long" : "Air ball", tooStrong ? "Relâche un peu plus tôt" : "Trop court : tire plus haut", [tooStrong ? "long" : "short"]);
    }
    // sol
    if (this.by < R) {
      this.by = R;
      if (this.vy < -1) audio.bounce(Math.min(1, -this.vy / 7));
      this.vy = -this.vy * 0.72;
      this.vx *= 0.85;
      this.vz *= 0.85;
    }
  }

  private made(label: string, detail: string, tags: string[]) {
    this.scored = true;
    this.netPulse = 1;
    audio.swish();
    audio.crowd("goal");
    const base = (this.spot.three ? 150 : 100) + (tags.includes("swish") ? 50 : 0);
    if (!this.s.reduced) {
      const p = this.cam.p(0, RIM_Y, 0);
      confettiBurst(this.parts, p.x, p.y - 20, 50, Math.max(this.w, this.h) * 0.4);
    }
    this.resolve(true, label, detail, [...tags, ...(this.spot.three ? ["three"] : [])], base);
  }

  private resolve(scored: boolean, label: string, detail: string, tags: string[], base = 0) {
    if (this.outcome) return;
    if (!scored && !tags.includes("block")) audio.crowd("groan");
    this.outcome = { scored, base, tags, label, detail, zone: 0 };
    this.resolvedAt = this.t;
    this.phase = "done";
  }

  /* ---------------- Rendu ---------------- */

  render() {
    if (!this.s || !this.w) return;
    if (this.bgDirty || !this.bg) this.renderBackground();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg!, 0, 0, this.w, this.h);

    if (this.use3d) {
      drawParticles(ctx, this.parts);
      if (this.phase === "aim" || this.phase === "idle") this.drawAimGuide(ctx);
      const c3 = this.c3!;
      c3.sync(this.cam, this.w, this.h, { zoom: 1, gx: 0, gy: 0, ox: 0, oy: 0 });
      const B = this.c3m!.BONE;
      const sh = this.A.shooter!;
      if (this.held) {
        sh.root.updateMatrixWorld(true);
        if (this.phase === "idle") {
          const h = sh.bone(B.rHand);
          const k = clamp((h.y - 0.85) / 0.4, 0, 1);
          c3.setBall(h.x, R + (h.y - 0.08 - R) * k, h.z + 0.08);
        } else {
          const l = sh.bone(B.lHand);
          const r = sh.bone(B.rHand);
          c3.setBall((l.x + r.x) / 2 + this.u.x * 0.1, (l.y + r.y) / 2 + 0.12, (l.z + r.z) / 2 + this.u.z * 0.1);
        }
      } else {
        // rétro-effet : le ballon tourne vers le tireur
        const w = { x: this.perp.x * -9, y: 0, z: this.perp.z * -9 };
        c3.setBall(this.bx, this.by, this.bz, w, undefined, this.lastDt);
      }
      c3.updateHoop(this.netPulse, this.t);
      c3.render();
      return;
    }

    this.drawBoard(ctx);
    const ballBehindRim = !this.held && this.bz > 0.02 && this.by > RIM_Y - 0.5;
    this.drawRim(ctx, "back");
    if (ballBehindRim) this.drawBall(ctx);
    this.drawNet(ctx);
    this.drawRim(ctx, "front");

    const ents: { z: number; draw: () => void }[] = [];
    if (this.s.stage.defender) {
      const closeout = this.defT0 < 0 ? 0 : clamp((this.t - this.defT0) / 0.28, 0, 1);
      const defDist = 1.55 - closeout * 0.38;
      const dz = this.depthOf(this.S.x + this.u.x * defDist + this.perp.x * 0.22, this.S.z + this.u.z * defDist + this.perp.z * 0.22);
      ents.push({ z: dz, draw: () => this.drawDefender(ctx) });
    }
    if (!this.held && !ballBehindRim) ents.push({ z: this.depthOf(this.bx, this.bz), draw: () => this.drawBall(ctx) });
    ents.push({ z: this.depthOf(this.S.x, this.S.z), draw: () => this.drawShooter(ctx) });
    ents.sort((a, b) => b.z - a.z).forEach((e) => e.draw());
    drawParticles(ctx, this.parts);
    if (this.phase === "aim" || this.phase === "idle") this.drawAimGuide(ctx);
  }

  private depthOf(x: number, z: number) {
    return this.cam.rel(x, z)[1];
  }

  private drawBoard(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const q = (x0: number, y0: number, x1: number, y1: number, z: number) => {
      const a = cam.p(x0, y1, z);
      const b = cam.p(x1, y1, z);
      const c = cam.p(x1, y0, z);
      const d = cam.p(x0, y0, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
    };
    q(-0.9, 2.9, 0.9, 3.95, BOARD_Z);
    ctx.fillStyle = "rgba(226,240,255,0.82)";
    ctx.fill();
    const m = cam.p(0, 3, BOARD_Z);
    ctx.lineWidth = Math.max(1.5, 0.05 * m.s);
    ctx.strokeStyle = "#f8fafc";
    ctx.stroke();
    // logo sur la planche
    const img = brandImage(LOGO_BL);
    if (img) {
      const a = cam.p(-0.18, 3.88, BOARD_Z);
      const b = cam.p(0.18, 3.55, BOARD_Z);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.globalAlpha = 1;
    }
    q(-0.295, 3.05, 0.295, 3.5, BOARD_Z);
    ctx.strokeStyle = "#D81E27";
    ctx.lineWidth = Math.max(1.5, 0.05 * m.s);
    ctx.stroke();
    // reflet
    q(-0.9, 3.6, -0.3, 3.95, BOARD_Z);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();
  }

  private rimPoints() {
    const pts: { x: number; y: number; s: number; z: number; back: boolean }[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = Math.cos(a) * RIM_R;
      const z = Math.sin(a) * RIM_R;
      const p = this.cam.p(x, RIM_Y, z);
      pts.push({ ...p, back: this.depthOf(x, z) > this.depthOf(0, 0) });
    }
    return pts;
  }

  private drawRim(ctx: CanvasRenderingContext2D, layer: "back" | "front") {
    const pts = this.rimPoints();
    const c = this.cam.p(0, RIM_Y, 0);
    ctx.lineCap = "round";
    ctx.strokeStyle = layer === "back" ? "#c2410c" : "#ea580c";
    ctx.lineWidth = Math.max(2, 0.035 * c.s);
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p.back === (layer === "back")) {
        if (!pen) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        pen = true;
      } else pen = false;
    }
    ctx.stroke();
    if (layer === "back") {
      // support du cercle
      const a = this.cam.p(0, RIM_Y, BOARD_Z);
      const b = this.cam.p(0, RIM_Y, RIM_R);
      ctx.lineWidth = Math.max(2, 0.04 * c.s);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  private drawNet(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const sway = this.netPulse;
    const N = 12;
    const rows = 4;
    ctx.strokeStyle = "rgba(248,250,252,0.85)";
    ctx.lineWidth = 1;
    const pt = (i: number, r: number) => {
      const a = (i / N) * Math.PI * 2;
      const k = r / rows;
      const rad = RIM_R * (1 - k * 0.42) * (1 + sway * 0.25 * Math.sin(k * Math.PI));
      const y = RIM_Y - k * 0.42 * (1 + sway * 0.35);
      return cam.p(Math.cos(a) * rad, y, Math.sin(a) * rad);
    };
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      for (let r = 0; r < rows; r++) {
        const a = pt(i, r);
        const b = pt(i + 1, r + 1);
        const c = pt(i - 1, r + 1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }
    }
    ctx.stroke();
  }

  private drawShooter(ctx: CanvasRenderingContext2D) {
    const sk = this.shooterSkeleton();
    const g = this.cam.p(this.S.x, 0, this.S.z);
    // le tireur fait face au panier : léger décalage écran selon l'orientation caméra
    drawFigure(ctx, sk, this.body, this.kit, { sx: g.x, sy: g.y, s: g.s }, { facing: "back" });
    if (this.held) {
      let bp;
      if (this.phase === "idle") {
        const d = Math.abs(Math.sin(this.t * 6));
        const hx = sk.haR.x + 0.08;
        const hy = lerp(R + 0.02, sk.haR.y - 0.05, d);
        bp = { x: g.x + hx * g.s, y: g.y - hy * g.s };
      } else {
        const hx = (sk.haL.x + sk.haR.x) / 2;
        const hy = (sk.haL.y + sk.haR.y) / 2 + 0.12;
        bp = { x: g.x + hx * g.s, y: g.y - hy * g.s };
      }
      drawBasketball(ctx, bp.x, bp.y, R * g.s, this.spin, this.s.fire);
      if (this.s.money) this.moneyRing(ctx, bp.x, bp.y, R * g.s);
    }
  }

  private moneyRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.strokeStyle = "#F4C400";
    ctx.lineWidth = Math.max(2, r * 0.25);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawDefender(ctx: CanvasRenderingContext2D) {
    const t = this.t;
    let p: Pose;
    const air = this.defenderAir(t);
    const closeout = this.defT0 < 0 ? 0 : clamp((t - this.defT0) / 0.28, 0, 1);
    const defDist = 1.55 - closeout * 0.38;
    if (this.defT0 < 0) {
      p = { ...POSES.guard, px: Math.sin(t * 2.8) * 0.16 };
    } else {
      const pre = this.defJumpAt - t;
      if (pre > 0) {
        const crouch = pre < 0.28 ? 1 - pre / 0.28 : 0;
        p = lerpPose(POSES.guard, { ...POSES.guard, lean: 0.65, hipL: -0.6, knL: 1.0, hipR: 0.6, knR: -1.0 }, crouch);
        p = { ...p, px: Math.sin(t * 5.5) * 0.08 };
      } else {
        p = lerpPose(POSES.guard, POSES.contest, clamp(air / 0.25, 0, 1));
        p = { ...p, air };
      }
    }
    const sk = skeleton(p, this.defBody);
    const pos = {
      x: this.S.x + this.u.x * defDist + this.perp.x * 0.22,
      z: this.S.z + this.u.z * defDist + this.perp.z * 0.22
    };
    const g = this.cam.p(pos.x, 0, pos.z);
    drawFigure(ctx, sk, this.defBody, RIVAL_BASKET_KIT, { sx: g.x, sy: g.y, s: g.s }, { facing: "front" });
  }

  private drawBall(ctx: CanvasRenderingContext2D) {
    const cam = this.cam;
    const sh = cam.p(this.bx, 0, this.bz);
    const hgt = this.by;
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.35 - hgt * 0.07, 0.05, 0.35)})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, R * sh.s * 1.2, R * sh.s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    this.trail.forEach((tp, i) => {
      const p = cam.p(tp.x, tp.y, tp.z);
      ctx.fillStyle = this.s.fire ? `rgba(255,140,30,${(i / this.trail.length) * 0.35})` : `rgba(255,255,255,${(i / this.trail.length) * 0.15})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * p.s, 0, Math.PI * 2);
      ctx.fill();
    });
    const p = cam.p(this.bx, this.by, this.bz);
    drawBasketball(ctx, p.x, p.y, Math.max(2, R * p.s), this.spin, this.s.fire);
    if (this.s.money) this.moneyRing(ctx, p.x, p.y, R * p.s);
  }

  /** Jauge de puissance + aide visuelle. */
  private drawAimGuide(ctx: CanvasRenderingContext2D) {
    const W = this.w;
    const H = this.h;
    const portrait = H > W;
    const gh = Math.min(H * 0.34, 260);
    const gw = 16;
    const gx = portrait ? W - 34 : W * 0.5 + Math.min(W * 0.3, 360);
    const gy = H * 0.5 - gh * 0.1;
    // fond
    ctx.fillStyle = "rgba(2,6,23,0.6)";
    roundRect(ctx, gx - 6, gy - 6, gw + 12, gh + 12, 12);
    ctx.fill();
    // zone verte (proportion de la jauge)
    const toY = (p: number) => gy + gh - (p / 1.15) * gh;
    const z0 = toY(this.ideal + this.windowW);
    const z1 = toY(this.ideal - this.windowW);
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fillRect(gx, z0, gw, z1 - z0);
    ctx.fillStyle = "rgba(134,239,172,0.95)";
    const zc = toY(this.ideal);
    const sw = (z1 - z0) * 0.3;
    ctx.fillRect(gx, zc - sw / 2, gw, sw);
    // remplissage
    if (this.phase === "aim") {
      const py = toY(this.power);
      const inZone = Math.abs(this.power - this.ideal) <= this.windowW;
      ctx.fillStyle = inZone ? "rgba(244,196,0,0.95)" : "rgba(248,250,252,0.75)";
      ctx.fillRect(gx + 4, py, gw - 8, gy + gh - py);
      ctx.fillStyle = "#fff";
      ctx.fillRect(gx - 8, py - 1.5, gw + 16, 3);
      // ligne de visée
      if (this.touch) {
        ctx.strokeStyle = "rgba(244,196,0,0.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(this.touch.x0, this.touch.y0);
        ctx.lineTo(this.touch.x, this.touch.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(244,196,0,0.9)";
        ctx.beginPath();
        ctx.arc(this.touch.x, this.touch.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      // arc fantôme (mode facile)
      if (this.s.diff.assist && this.power > 0.1) this.drawGhostArc(ctx);
    } else if (!this.s.reduced) {
      const k = (Math.sin(this.t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + k * 0.3})`;
      ctx.fillRect(gx + 4, toY(0.25 + k * 0.4), gw - 8, gy + gh - toY(0.25 + k * 0.4));
    }
  }

  private drawGhostArc(ctx: CanvasRenderingContext2D) {
    const e = clamp((this.power - this.ideal) / this.windowW, -4, 4);
    const m = this.mMid + e * (e < 0 ? this.mMid - this.mLo : this.mHi - this.mMid) * 0.95;
    const v = this.launchVel(m, this.aimX * 0.035);
    const P = this.releasePoint();
    const st = { x: P.x, y: P.y, z: P.z, vx: v.x, vy: v.y, vz: v.z, rim: false, board: false };
    ctx.strokeStyle = Math.abs(e) <= 1 ? "rgba(134,239,172,0.85)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    for (let i = 0; i < 400; i++) {
      const prevY = st.y;
      this.integrate(st, 1 / 120, false);
      const p = this.cam.p(st.x, st.y, st.z);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      if (prevY >= RIM_Y && st.y < RIM_Y && st.vy < 0) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

