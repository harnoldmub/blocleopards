/**
 * Outils partagés des deux jeux : caméra perspective, images de marque,
 * particules, ballon, foule.
 */

export interface Proj {
  x: number;
  y: number;
  s: number;
  z: number;
}

export class Camera {
  x = 0;
  y = 2.6;
  z = -9;
  yaw = 0;
  f = 900;
  cx = 0;
  hz = 0;
  private c = 1;
  private sn = 0;

  setYaw(yaw: number) {
    this.yaw = yaw;
    this.c = Math.cos(yaw);
    this.sn = Math.sin(yaw);
  }

  /** Coordonnées caméra (rx latéral, rz profondeur). */
  rel(X: number, Z: number): [number, number] {
    const dx = X - this.x;
    const dz = Z - this.z;
    return [dx * this.c - dz * this.sn, dx * this.sn + dz * this.c];
  }

  p(X: number, Y: number, Z: number): Proj {
    const [rx, rz0] = this.rel(X, Z);
    const rz = Math.max(0.3, rz0);
    const s = this.f / rz;
    return { x: this.cx + rx * s, y: this.hz - (Y - this.y) * s, s, z: rz };
  }

  /** Point écran → point du plan vertical Z = cte (en ignorant les petits lacets). */
  unprojectZ(sx: number, sy: number, Z: number): { x: number; y: number } {
    const a = (sx - this.cx) / this.f;
    const dz = Z - this.z;
    const dx = (dz * (this.sn + a * this.c)) / (this.c - a * this.sn);
    const [, rz] = this.rel(this.x + dx, Z);
    return { x: this.x + dx, y: this.y - ((sy - this.hz) * rz) / this.f };
  }
}

/* ---------- Images de marque ---------- */

const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

export function brandImage(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => listeners.forEach((fn) => fn());
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function onBrandLoad(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const LOGO_BL = "/brand/logo-arena.webp";
export const LOGO_RDC = "/brand/rdc-coeur-afrique-white.webp";

/** Partenaires affichés en publicité (panneaux LED, bandeaux). */
export const PARTNERS = [
  { name: "SONAS", src: "/brand/partners/sonas.webp", accent: "#f7d618" },
  { name: "EQUITY BCDC", src: "/brand/partners/equity-bcdc.webp", accent: "#b3202c" },
  { name: "MFS GROUPE", src: "/brand/partners/mfs.webp", accent: "#007fff" },
  { name: "SHALINA", src: "/brand/partners/shalina.webp", accent: "#1b4fc4" },
  { name: "FONAREV", src: "/brand/partners/fonarev.webp", accent: "#007fff" },
  { name: "VISA", src: "/brand/partners/visa.webp", accent: "#1a1f71" }
];

/** Panneau partenaire : fond blanc, logo centré, liseré couleur. */
export function drawPartnerPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number) {
  const pt = PARTNERS[((index % PARTNERS.length) + PARTNERS.length) % PARTNERS.length];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pt.accent;
  ctx.fillRect(x, y, w, Math.max(1, h * 0.08));
  const img = brandImage(pt.src);
  const pad = h * 0.16;
  if (img) {
    let ih = h - pad * 2;
    let iw = (ih * img.naturalWidth) / img.naturalHeight;
    if (iw > w - pad * 2) {
      iw = w - pad * 2;
      ih = (iw * img.naturalHeight) / img.naturalWidth;
    }
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2 + h * 0.03, iw, ih);
  } else {
    ctx.fillStyle = pt.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(h * 0.45)}px 'Bebas Neue', Anton, sans-serif`;
    ctx.fillText(pt.name, x + w / 2, y + h / 2, w - pad * 2);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.restore();
}

/** Panneau de marque : alterne écusson Bloc Léopards et « RD Congo · Cœur de l'Afrique ». */
export function drawBrandPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: "bl" | "rdc",
  bg = "#08132B"
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const pad = h * 0.12;
  if (kind === "bl") {
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "#0B47B0");
    g.addColorStop(1, "#08132B");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const img = brandImage(LOGO_BL);
    const ih = h - pad * 2;
    let tx = x + pad;
    if (img) {
      const iw = (ih * img.naturalWidth) / img.naturalHeight;
      ctx.drawImage(img, x + pad, y + pad, iw, ih);
      tx = x + pad * 2 + iw;
    }
    ctx.fillStyle = "#F4C400";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(h * 0.5)}px 'Bebas Neue', Anton, sans-serif`;
    ctx.fillText("BLOC LÉOPARDS", tx, y + h * 0.54, x + w - tx - pad);
  } else {
    const img = brandImage(LOGO_RDC);
    if (img) {
      const ih = h - pad * 2.2;
      const iw = Math.min(w - pad * 2, (ih * img.naturalWidth) / img.naturalHeight);
      const ih2 = (iw * img.naturalHeight) / img.naturalWidth;
      ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih2) / 2, iw, ih2);
    } else {
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = `${Math.round(h * 0.42)}px 'Bebas Neue', Anton, sans-serif`;
      ctx.fillText("R.D. CONGO · CŒUR DE L'AFRIQUE", x + w / 2, y + h / 2, w - pad * 2);
      ctx.textAlign = "left";
    }
    // liseré drapeau
    const sh = Math.max(1, h * 0.06);
    ctx.fillStyle = "#007fff";
    ctx.fillRect(x, y + h - sh, w / 3, sh);
    ctx.fillStyle = "#f7d618";
    ctx.fillRect(x + w / 3, y + h - sh, w / 3, sh);
    ctx.fillStyle = "#ce1021";
    ctx.fillRect(x + (2 * w) / 3, y + h - sh, w / 3, sh);
  }
  ctx.restore();
}

/* ---------- Particules ---------- */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spin: number;
  rot: number;
  kind: "confetti" | "dust" | "spark";
}

const FLAG = ["#007fff", "#f7d618", "#ce1021", "#ffffff", "#F4C400"];

export function confettiBurst(list: Particle[], x: number, y: number, n: number, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = spread * (0.4 + Math.random() * 0.9);
    list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 1.6 + Math.random() * 1.2,
      size: 3 + Math.random() * 4,
      color: FLAG[i % FLAG.length],
      spin: (Math.random() - 0.5) * 14,
      rot: Math.random() * 6,
      kind: "confetti"
    });
  }
}

export function dustBurst(list: Particle[], x: number, y: number, n: number, color: string, scale = 1) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
    const v = (60 + Math.random() * 140) * scale;
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.4, size: (1.5 + Math.random() * 2.5) * scale, color, spin: 0, rot: 0, kind: "dust" });
  }
}

export function updateParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life > p.max) {
      list.splice(i, 1);
      continue;
    }
    const drag = p.kind === "confetti" ? 1.8 : 3;
    p.vx -= p.vx * drag * dt;
    p.vy += (p.kind === "confetti" ? 140 : 380) * dt;
    p.vy -= p.vy * (p.kind === "confetti" ? 1.6 : 0.5) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
    ctx.fillStyle = p.color;
    if (p.kind === "confetti") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.rot * 1.3)) + 1);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- Ballons ---------- */

export function drawFootball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.7, "#e5e7eb");
  g.addColorStop(1, "#9ca3af");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.rotate(spin);
  ctx.fillStyle = "#111827";
  const pent = (cx: number, cy: number, rr: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.fill();
  };
  pent(0, 0, r * 0.32);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.3);
  }
  // accent drapeau
  ctx.fillStyle = "rgba(20,102,224,0.55)";
  ctx.beginPath();
  ctx.arc(r * 0.5, r * 0.45, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(0.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawBasketball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, fire = false) {
  ctx.save();
  if (fire) {
    const fg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
    fg.addColorStop(0, "rgba(255,170,40,0.7)");
    fg.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ffa24a");
  g.addColorStop(0.75, "#e2580b");
  g.addColorStop(1, "#8a3104");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.rotate(spin);
  ctx.strokeStyle = "#2b1203";
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-r * 1.05, 0, r * 0.55, r, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(r * 1.05, 0, r * 0.55, r, 0, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------- Foule ---------- */

const CROWD = ["#1466E0", "#F4C400", "#D81E27", "#f8fafc", "#0B47B0", "#1e293b", "#F4C400", "#1466E0"];
const SKIN = ["#3d2416", "#4a2c1a", "#5a3520", "#6b4128", "#7a4b2e"];

/** Rangée de supporters (tête + buste) entre deux lignes écran. */
export function crowdRow(ctx: CanvasRenderingContext2D, x0: number, x1: number, yTop: number, yBot: number, seed: number, flags = true) {
  const h = yBot - yTop;
  if (h < 1.2) {
    ctx.fillStyle = CROWD[seed % CROWD.length];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x0, yTop, x1 - x0, Math.max(1, h));
    ctx.globalAlpha = 1;
    return;
  }
  const step = Math.max(2, h * 0.75);
  let i = seed;
  for (let x = x0 + ((seed * 7) % step); x < x1; x += step * (0.8 + ((i * 13) % 7) / 14)) {
    i++;
    const c = CROWD[(i * 31 + seed) % CROWD.length];
    ctx.fillStyle = c;
    ctx.fillRect(x - step * 0.42, yTop + h * 0.45, step * 0.84, h * 0.6);
    ctx.fillStyle = SKIN[(i * 17) % SKIN.length];
    ctx.beginPath();
    ctx.arc(x, yTop + h * 0.32, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    if (flags && h > 4 && (i * 37 + seed) % 23 === 0) {
      // drapeau brandi
      ctx.fillStyle = "#007fff";
      ctx.fillRect(x, yTop - h * 0.9, h * 1.3, h * 0.85);
      ctx.fillStyle = "#ce1021";
      ctx.beginPath();
      ctx.moveTo(x, yTop - h * 0.05);
      ctx.lineTo(x + h * 1.3, yTop - h * 0.9);
      ctx.lineTo(x + h * 1.3, yTop - h * 0.6);
      ctx.lineTo(x + h * 0.25, yTop - h * 0.05);
      ctx.fill();
      ctx.fillStyle = "#f7d618";
      ctx.beginPath();
      ctx.arc(x + h * 0.25, yTop - h * 0.68, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
