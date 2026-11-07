import { useEffect, useRef, useState } from "react";
import { Flame, Hand, LoaderCircle, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { GameId } from "./lib/config";
import { FootEngine, type FootSetup, type ShotOutcome } from "./engine/foot";
import { BasketEngine, type BasketSetup } from "./engine/basket";

type AnyEngine = FootEngine | BasketEngine;

export interface Splash {
  key: number;
  label: string;
  points: number;
  detail: string;
  tags: string[];
  scored: boolean;
}

export interface Hud {
  score: number;
  title: string;
  sub: string;
  shots: (boolean | null)[];
  streak: number;
  mult: number;
  player?: { name: string; color: string };
  chrono?: number;
  target?: { name: string; score: number };
}

const TAG_LABEL: Record<string, string> = {
  lucarne: "Lucarne",
  "petit-filet": "Petit filet",
  effet: "Enroulée",
  panenka: "Panenka",
  "post-in": "Poteau rentrant",
  "coup-franc": "Coup franc",
  swish: "Swish",
  three: "3 points",
  bank: "Planche",
  money: "Ballon d'or ×2"
};

export default function GameView(props: {
  game: GameId;
  setupKey: string;
  setup: FootSetup | BasketSetup;
  paused: boolean;
  clockMax: number;
  hud: Hud;
  hint: string | null;
  splash: Splash | null;
  onResult: (o: ShotOutcome) => void;
  onKick: () => void;
  onPause: () => void;
  onInteract: () => void;
  soundOn?: boolean;
  onToggleSound?: () => void;
  /** Une joueuse est en jeu : charger son modèle 3D. */
  needsFemale?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AnyEngine | null>(null);
  const pausedRef = useRef(props.paused);
  const cbRef = useRef(props);
  cbRef.current = props;
  pausedRef.current = props.paused;
  const clockRef = useRef({ left: props.clockMax, running: false });
  const [clock, setClock] = useState(props.clockMax);
  const [aiming, setAiming] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const gameReady = loadState === "ready";
  const inputEnabledRef = useRef(false);
  pausedRef.current = props.paused || !gameReady;
  inputEnabledRef.current = !props.paused && gameReady;

  // création du moteur
  useEffect(() => {
    setLoadState("loading");
    const cv = canvasRef.current!;
    const cb = {
      onKick: () => {
        clockRef.current.running = false;
        cbRef.current.onKick();
      },
      onResult: (o: ShotOutcome) => cbRef.current.onResult(o),
      onAim: (a: boolean) => setAiming(a)
    };
    const engine: AnyEngine = props.game === "foot" ? new FootEngine(cv, cb) : new BasketEngine(cv, cb);
    engineRef.current = engine;
    let c3: import("./engine/chars3d").Chars3D | null = null;
    let disposed = false;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      engine.resize(r.width, r.height, dpr);
      c3?.resize(r.width, r.height, dpr);
    };
    // personnages 3D : chargés en arrière-plan, repli 2D si WebGL indisponible
    if (canvas3dRef.current) {
      import("./engine/chars3d")
        .then(async (mod) => {
          if (disposed || !canvas3dRef.current) return;
          try {
            c3 = new mod.Chars3D(canvas3dRef.current, props.game);
          } catch {
            return;
          }
          fit();
          await c3.load(props.game === "foot" ? ["kick", "dive", "catch", "scoop", "twist", "bboy"] : ["dribble", "catch"]);
          if (disposed) return;
          if (!c3.ready) {
            setLoadState("error");
            return;
          }
          const attach = () => {
            if (disposed || !c3) return;
            if (props.game === "foot") (engine as FootEngine).attach3D(c3, mod);
            else (engine as BasketEngine).attach3D(c3, mod);
          };
          if (props.needsFemale) {
            await c3.loadFemale();
            if (disposed) return;
            if (!c3.femProto) {
              setLoadState("error");
              return;
            }
          }
          attach();
          setLoadState("ready");
        })
        .catch(() => {
          if (!disposed) setLoadState("error");
        });
    } else {
      setLoadState("error");
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    let raf = 0;
    let last = performance.now();
    let lastShown = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && !document.hidden) {
        engine.update(dt);
        const c = clockRef.current;
        if (c.running && c.left > 0) {
          c.left = Math.max(0, c.left - dt);
          if (c.left === 0) {
            c.running = false;
            engine.timeout();
          }
        }
        const shown = Math.ceil(c.left);
        if (shown !== lastShown) {
          lastShown = shown;
          setClock(c.left);
        }
      }
      engine.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposed = true;
      c3?.dispose();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.game, props.needsFemale, loadAttempt]);

  // nouveau tir
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    (e as any).setup(props.setup);
    clockRef.current = { left: props.clockMax, running: props.clockMax > 0 };
    setClock(props.clockMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.setupKey, props.game]);

  // iOS/Safari : les Pointer Events peuvent être exposés mais ne pas fournir
  // une séquence complète sur un canvas plein écran. Les Touch Events natifs
  // deviennent donc la source de vérité pour le doigt. Les handlers pointer
  // restent actifs pour la souris et le stylet.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const point = (touch: Touch) => {
      const r = cv.getBoundingClientRect();
      return [touch.clientX - r.left, touch.clientY - r.top] as const;
    };
    const start = (ev: TouchEvent) => {
      if (!inputEnabledRef.current || ev.touches.length === 0) return;
      ev.preventDefault();
      props.onInteract();
      engineRef.current?.skip();
      engineRef.current?.down(...point(ev.touches[0]));
    };
    const move = (ev: TouchEvent) => {
      if (!inputEnabledRef.current || ev.touches.length === 0) return;
      ev.preventDefault();
      engineRef.current?.move(...point(ev.touches[0]));
    };
    const end = (ev: TouchEvent) => {
      if (!inputEnabledRef.current || ev.changedTouches.length === 0) return;
      ev.preventDefault();
      engineRef.current?.up(...point(ev.changedTouches[0]));
    };
    const cancel = (ev: TouchEvent) => {
      ev.preventDefault();
      engineRef.current?.cancel();
    };
    cv.addEventListener("touchstart", start, { passive: false });
    cv.addEventListener("touchmove", move, { passive: false });
    cv.addEventListener("touchend", end, { passive: false });
    cv.addEventListener("touchcancel", cancel, { passive: false });
    return () => {
      cv.removeEventListener("touchstart", start);
      cv.removeEventListener("touchmove", move);
      cv.removeEventListener("touchend", end);
      cv.removeEventListener("touchcancel", cancel);
    };
  }, [props.game]);

  const pt = (ev: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top] as const;
  };

  const { hud } = props;
  const lowClock = props.clockMax > 0 && clock <= 3;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#020617]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none select-none"
        role="img"
        aria-label={props.game === "foot" ? "Terrain : glisse le ballon vers la cage pour tirer" : "Terrain : maintiens appuyé et relâche au bon moment pour shooter"}
        onPointerDown={(ev) => {
          if (ev.pointerType === "touch") return;
          ev.preventDefault();
          if (props.paused || !gameReady) return;
          // Safari/iOS peut exposer setPointerCapture mais lever NotFoundError
          // pour un pointeur tactile pourtant actif. Le tir doit continuer :
          // le canvas plein écran + touch-action:none gardent déjà le geste.
          try {
            (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
          } catch {
            // Capture optionnelle, jamais bloquante.
          }
          props.onInteract();
          engineRef.current?.skip();
          engineRef.current?.down(...pt(ev));
        }}
        onPointerMove={(ev) => {
          if (ev.pointerType === "touch") return;
          if (!gameReady) return;
          ev.preventDefault();
          engineRef.current?.move(...pt(ev));
        }}
        onPointerUp={(ev) => {
          if (ev.pointerType === "touch") return;
          if (!gameReady) return;
          ev.preventDefault();
          engineRef.current?.up(...pt(ev));
        }}
        onPointerCancel={(ev) => {
          if (ev.pointerType !== "touch") engineRef.current?.cancel();
        }}
      />

      <canvas ref={canvas3dRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

      {loadState !== "ready" && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#020617] px-6 text-center" role="status" aria-live="polite">
          <div className="max-w-xs">
            {loadState === "loading" ? (
              <>
                <LoaderCircle className="mx-auto animate-spin text-[var(--a-gold)]" size={42} aria-hidden="true" />
                <h2 className="display mt-4 text-[34px]">Entrée sur le terrain…</h2>
                <p className="mt-2 text-[14px] text-[var(--a-muted)]">Chargement du joueur 3D et de ses animations.</p>
              </>
            ) : (
              <>
                <h2 className="display text-[34px]">Le joueur n’a pas chargé</h2>
                <p className="mt-2 text-[14px] text-[var(--a-muted)]">Vérifie ta connexion puis réessaie.</p>
                <button className="a-btn a-btn-primary mt-5" onClick={() => setLoadAttempt((n) => n + 1)}>
                  <RotateCcw size={18} /> Réessayer
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* HUD haut */}
      <div className="pointer-events-none absolute inset-x-0 top-0 safe-top px-3">
        <div className="flex items-start gap-2">
          <button className="a-icon-btn pointer-events-auto shrink-0" onClick={props.onPause} aria-label="Pause et menu">
            <Pause size={20} fill="currentColor" />
          </button>
          <div className="min-w-0 flex-1 rounded-2xl bg-[rgba(4,10,26,0.66)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {hud.player && (
                  <div className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wide" style={{ color: hud.player.color }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: hud.player.color }} />
                    <span className="truncate">{hud.player.name}</span>
                  </div>
                )}
                <div className="truncate text-[12px] font-bold text-[var(--a-muted)]">{hud.title}</div>
              </div>
              <div className="text-right">
                <div className="display text-[30px] tabular-nums text-white" aria-live="polite">
                  {hud.score}
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex gap-1" aria-label="Tirs de la série">
                {hud.shots.map((s, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${s === true ? "bg-[var(--a-green)]" : s === false ? "bg-[var(--a-red)]" : "bg-white/20"}`}
                  />
                ))}
              </div>
              <div className="truncate text-[11px] font-semibold text-white/70">{hud.sub}</div>
            </div>
          </div>
          {hud.chrono !== undefined ? (
            <div
              className={`flex h-[52px] min-w-[52px] flex-col items-center justify-center rounded-2xl px-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] ${hud.chrono <= 10 ? "bg-red-600/90" : "bg-[rgba(4,10,26,0.66)]"}`}
              aria-label={`Temps restant ${Math.ceil(hud.chrono)} secondes`}
            >
              <span className="display text-[26px] tabular-nums">{Math.ceil(hud.chrono)}</span>
            </div>
          ) : props.clockMax > 0 ? (
            <ClockRing value={clock} max={props.clockMax} low={lowClock} />
          ) : null}

          {props.onToggleSound && (
            <button
              className="a-icon-btn pointer-events-auto h-[52px] w-[52px] shrink-0 rounded-2xl flex items-center justify-center bg-[rgba(4,10,26,0.66)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] backdrop-blur transition-transform active:scale-95"
              onClick={props.onToggleSound}
              aria-label={props.soundOn ? "Couper le son" : "Activer le son"}
              title={props.soundOn ? "Couper le son" : "Activer le son"}
            >
              {props.soundOn ? <Volume2 size={22} className="text-[var(--a-gold)]" /> : <VolumeX size={22} className="text-red-400" />}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {hud.mult > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--a-gold)] px-2.5 py-1 text-[12px] font-black text-[#1a1300]">
              <Flame size={14} /> ×{hud.mult} · série de {hud.streak}
            </span>
          )}
          {hud.target && (
            <span className="rounded-full bg-[rgba(4,10,26,0.66)] px-2.5 py-1 text-[12px] font-bold text-white/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              À battre : {hud.target.name} · {hud.target.score}
            </span>
          )}
        </div>
      </div>

      {/* indication */}
      {props.hint && !aiming && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center safe-bottom px-4">
          {props.game === "foot" ? (
            <span className="a-hand mb-1 text-white/90" style={{ marginLeft: -40 }}>
              <Hand size={34} />
            </span>
          ) : null}
          <div className="a-pulse mb-2 rounded-full bg-[rgba(4,10,26,0.72)] px-4 py-2.5 text-center text-[14px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
            {props.hint}
          </div>
        </div>
      )}

      {/* résultat du tir */}
      {props.splash && (
        <div key={props.splash.key} className="pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center px-4 text-center" role="status" aria-live="assertive">
          <div className="a-splash flex flex-col items-center">
            <div className={`display text-[64px] sm:text-[84px] ${props.splash.scored ? "text-[var(--a-gold)]" : "text-white"}`}>{props.splash.label}</div>
            {props.splash.points > 0 && <div className="display text-[34px] text-white">+{props.splash.points}</div>}
            {props.splash.tags.filter((t) => TAG_LABEL[t]).length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {props.splash.tags
                  .filter((t) => TAG_LABEL[t])
                  .map((t) => (
                    <span key={t} className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-black uppercase text-slate-900">
                      {TAG_LABEL[t]}
                    </span>
                  ))}
              </div>
            )}
            <div className="mt-2 max-w-[300px] rounded-xl bg-[rgba(4,10,26,0.7)] px-3 py-1.5 text-[13px] font-semibold text-white/90">{props.splash.detail}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClockRing({ value, max, low }: { value: number; max: number; low: boolean }) {
  const r = 21;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative h-[52px] w-[52px] shrink-0" aria-label={`Chrono du tir : ${Math.ceil(value)} secondes`}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
        <circle cx="26" cy="26" r={r + 3} fill="rgba(4,10,26,0.66)" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={low ? "#ef4444" : "#F4C400"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - k)} />
      </svg>
      <span className={`display absolute inset-0 flex items-center justify-center text-[22px] tabular-nums ${low ? "text-red-400" : "text-white"}`}>{Math.ceil(value)}</span>
    </div>
  );
}
