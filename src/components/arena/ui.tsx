import { useEffect, useRef, useState, type ReactNode } from "react";
import { Star, X } from "lucide-react";
import { BODIES, FEMALE_BODY, LEOPARDS_BASKET_KIT, LEOPARDS_KIT, POSES, drawFigure, skeleton, lerpPose } from "./engine/people";
import { drawBasketball, drawFootball } from "./engine/scene";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

/** Feuille du bas, fermable par le voile ou Échap. */
export function Sheet({ title, onClose, children, footer, labelledBy }: { title?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // focus posé une seule fois à l'ouverture (sinon il quitte les champs à chaque frappe)
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <div className="a-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} className="a-sheet outline-none">
        <div className="a-sheet-grip" aria-hidden="true" />
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <h2 className="display text-[28px] text-white">{title}</h2>
            <button className="a-icon-btn" onClick={onClose} aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-white/10 px-5 pt-3">{footer}</div>}
      </div>
    </>
  );
}

/** Modale de confirmation (jamais de window.confirm). */
export function ConfirmModal({ title, text, confirm, danger, onCancel, onConfirm }: { title: string; text: string; confirm: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <div className="a-scrim" style={{ zIndex: 70 }} onClick={onCancel} aria-hidden="true" />
      <div className="a-modal p-5" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title" className="display text-[30px]">{title}</h2>
        <p id="confirm-text" className="mt-2 text-[15px] leading-relaxed text-[var(--a-muted)]">{text}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="a-btn a-btn-secondary" onClick={onCancel} autoFocus>
            Annuler
          </button>
          <button className={`a-btn ${danger ? "a-btn-danger" : "a-btn-primary"}`} onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 2600);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 safe-bottom" role="status" aria-live="polite">
      <div className="a-toast mb-3 rounded-2xl bg-white px-4 py-3 text-[14px] font-bold text-slate-900 shadow-2xl">{text}</div>
    </div>
  );
}

export function Stars({ n, size = 18, total = 3 }: { n: number; size?: number; total?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} étoile${n > 1 ? "s" : ""} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} size={size} strokeWidth={2} className={i < n ? "fill-[var(--a-gold)] text-[var(--a-gold)]" : "text-white/25"} />
      ))}
    </span>
  );
}

/** Illustration de carte : les vrais personnages du jeu, dessinés en direct. */
export function GamePreview({ game, reduced }: { game: "foot" | "basket"; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = (performance.now() - start) / 1000;
      if (game === "foot") {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#0b1a3a");
        g.addColorStop(0.62, "#13305e");
        g.addColorStop(0.62, "#1a6b38");
        g.addColorStop(1, "#22863f");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // cage
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        for (let x = w * 0.08; x < w * 0.92; x += 8) {
          ctx.beginPath();
          ctx.moveTo(x, h * 0.2);
          ctx.lineTo(x, h * 0.62);
          ctx.stroke();
        }
        for (let y = h * 0.2; y < h * 0.62; y += 8) {
          ctx.beginPath();
          ctx.moveTo(w * 0.08, y);
          ctx.lineTo(w * 0.92, y);
          ctx.stroke();
        }
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w * 0.08, h * 0.64);
        ctx.lineTo(w * 0.08, h * 0.2);
        ctx.lineTo(w * 0.92, h * 0.2);
        ctx.lineTo(w * 0.92, h * 0.64);
        ctx.stroke();
        // petite séquence en boucle : tir en lucarne, plongeon, le ballon gonfle le filet puis retombe
        const body = BODIES[1];
        const kit = { jersey: "#a3e635", jersey2: "#4d7c0f", trim: "#0f172a", shorts: "#0f172a", socks: "#a3e635", boots: "#111827", gloves: "#f8fafc", gloves2: "#16a34a", longSleeves: true, number: "1" };
        const C = 3.4;
        const c = reduced ? 2.5 : t % C;
        const ground = h * 0.62;
        const sc = h * 0.2;
        let kp = POSES.keeperReady;
        if (c > 0.75 && c < 1.25) kp = lerpPose(POSES.keeperSet, POSES.diveHighR, Math.min(1, (c - 0.75) / 0.35));
        else if (c >= 1.25) kp = lerpPose(POSES.diveHighR, POSES.lieR, Math.min(1, (c - 1.25) / 0.45));
        const px = c > 0.75 ? Math.min(1, (c - 0.75) / 0.4) * 0.45 : 0;
        const sk = skeleton({ ...kp, px }, body);
        drawFigure(ctx, sk, body, kit, { sx: w * 0.42, sy: ground, s: sc }, { facing: "front", shadow: false });
        // ballon
        let bx: number;
        let by: number;
        let br: number;
        const tx = w * 0.86;
        const ty = h * 0.3;
        if (c < 0.7) {
          bx = w * 0.5;
          by = h * 0.93;
          br = h * 0.065;
        } else if (c < 1.15) {
          const k = (c - 0.7) / 0.45;
          bx = w * 0.5 + (tx - w * 0.5) * k;
          by = h * 0.93 + (ty - h * 0.93) * k - Math.sin(k * Math.PI) * h * 0.12;
          br = h * (0.065 - 0.02 * k);
        } else {
          // retombe dans le filet : gravité + rebonds amortis
          const f = c - 1.15;
          const restY = ground - h * 0.045 - h * 0.03;
          const fallT = Math.sqrt((2 * (restY - ty)) / (h * 4));
          bx = tx + Math.min(f, 0.25) * w * 0.04;
          if (f < fallT) by = ty + 0.5 * h * 4 * f * f;
          else {
            const b = f - fallT;
            const hop = Math.max(0, Math.sin(b * 9) * Math.exp(-b * 4)) * h * 0.06;
            by = restY - hop;
          }
          br = h * 0.045;
        }
        drawFootball(ctx, bx, by, br, reduced ? 0.5 : t * 5);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#475569");
        g.addColorStop(0.55, "#cbd5e1");
        g.addColorStop(0.55, "#237a5d");
        g.addColorStop(1, "#1d6b52");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#e8743b";
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.82, w * 0.55, h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f97316";
        ctx.fillRect(w * 0.06, h * 0.08, w * 0.08, h * 0.5);
        // panier
        ctx.fillStyle = "rgba(240,248,255,0.92)";
        ctx.fillRect(w * 0.58, h * 0.08, w * 0.34, h * 0.2);
        ctx.strokeStyle = "#D81E27";
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.68, h * 0.15, w * 0.14, h * 0.1);
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(w * 0.75, h * 0.28, w * 0.07, h * 0.015, 0, 0, Math.PI * 2);
        ctx.stroke();
        const body = BODIES[0];
        const p = reduced ? POSES.hoopRelease : { ...POSES.hoopRelease, air: 0.25 + Math.abs(Math.sin(t * 2)) * 0.15 };
        const sk = skeleton(p, body);
        const pl = { sx: w * 0.36, sy: h * 0.95, s: h * 0.26 };
        drawFigure(ctx, sk, body, LEOPARDS_BASKET_KIT("LÉOPARD", 10), pl, { facing: "back", shadow: false });
        const hx = (sk.haL.x + sk.haR.x) / 2;
        const hy = (sk.haL.y + sk.haR.y) / 2 + 0.14;
        drawBasketball(ctx, pl.sx + hx * pl.s, pl.sy - hy * pl.s, 0.12 * pl.s, t);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [game, reduced]);
  return <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />;
}

/**
 * Aperçu 3D du personnage choisi (joueur ou joueuse), qui tourne lentement :
 * maillot des Léopards avec le nom et le numéro saisis. Silhouette 2D pendant le chargement.
 */
export function CharacterPreview({ female, character, name, number, reduced }: { female: boolean; character?: string; name: string; number: number; reduced: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv2d = useRef<HTMLCanvasElement>(null);
  const cv3d = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ c3: any; mod: any; actor: any; cam: any; key: string } | null>(null);
  const props = useRef({ female, character, name, number, reduced });
  props.current = { female, character, name, number, reduced };
  const [ready, setReady] = useState(false);

  // silhouette 2D de secours
  useEffect(() => {
    const cv = cv2d.current;
    if (!cv) return;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const body = female ? FEMALE_BODY : BODIES[0];
    const sk = skeleton(POSES.shooterIdle, body);
    drawFigure(ctx, sk, body, LEOPARDS_KIT(name || "LÉOPARD", number), { sx: w / 2, sy: h * 0.96, s: h * 0.47 }, { facing: "back" });
  }, [female, name, number]);

  // scène 3D
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    import("./engine/chars3d").then(async (mod) => {
      if (disposed || !cv3d.current) return;
      let c3: any;
      try {
        c3 = new mod.Chars3D(cv3d.current, "foot");
      } catch {
        return;
      }
      const el = cv3d.current;
      const fit = () => c3.resize(el.clientWidth, el.clientHeight, Math.min(2, window.devicePixelRatio || 1));
      fit();
      // réseau capricieux (ou serveur relancé) : on réessaie avant de rester sur la silhouette 2D
      for (let attempt = 0; attempt < 4 && !disposed && !c3.ready; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
        c3.failed = false;
        await c3.load(["catch"]);
      }
      if (disposed || !c3.ready) return c3.dispose();
      const { Camera } = await import("./engine/scene");
      const cam = new Camera();
      state.current = { c3, mod, actor: null, cam, key: "" };
      setReady(true);
      const start = performance.now();
      const loop = () => {
        const st = state.current;
        if (!st || disposed) return;
        const p = props.current;
        // personnage chargé à la demande ; l'ancien reste affiché en attendant
        const cid = mod.charFor(p.character, p.female);
        const loaded = c3.isLoaded([cid]);
        if (!loaded) c3.ensureChars([cid]);
        const key = `${loaded ? cid : "wait"}|${p.name}|${p.number}`;
        if (key !== st.key && (loaded || !st.actor)) {
          if (st.actor) c3.remove(st.actor);
          st.actor = c3.actor({ ...mod.LEOPARDS_PAINT(p.name || "LÉOPARD", p.number, p.female ? "#6b4128" : "#5a3520"), female: p.female }, loaded ? cid : null);
          st.actor.inPlace = true;
          st.key = key;
        }
        const w = el.clientWidth;
        const h = el.clientHeight;
        cam.x = 0;
        cam.y = 1.0;
        cam.z = -3.4;
        cam.setYaw(0);
        cam.f = h * 1.55;
        cam.cx = w / 2;
        cam.hz = h * 0.5;
        c3.sync(cam, w, h, { zoom: 1, gx: 0, gy: 0, ox: 0, oy: 0 });
        c3.setShadowCenter(0, 0);
        const t = (performance.now() - start) / 1000;
        // commence de dos (nom + numéro), puis tourne lentement
        const yaw = p.reduced ? 0.35 : Math.sin(t * 0.55) * 2.6;
        st.actor.place(0, 0, yaw);
        // Mixamo : posture debout naturelle (début de l'animation de tête)
        if (st.actor.rig === "mx") st.actor.pose("header", 0.05);
        else st.actor.pose("catch", 0.02);
        c3.render();
        raf = requestAnimationFrame(loop);
      };
      loop();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      state.current?.c3.dispose();
      state.current = null;
    };
  }, []);

  return (
    <div ref={wrap} className="relative h-full w-full">
      <canvas ref={cv2d} className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`} aria-hidden="true" />
      <canvas ref={cv3d} className="absolute inset-0 h-full w-full" role="img" aria-label={`Aperçu : ${female ? "ta joueuse" : "ton joueur"} avec le maillot ${name || ""} ${number}`} />
    </div>
  );
}
