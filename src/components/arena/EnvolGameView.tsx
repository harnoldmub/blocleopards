import { t } from "./lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Coins,
  Plus,
  Minus,
  RotateCcw,
  Plane,
  Sparkles,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Envol3D } from "./engine/envol3d";
import ChampionsLeaderboard from "./ChampionsLeaderboard";
import "./arena.css";

interface Props {
  playerName: string;
  playerTag: string;
  opponent?: { name: string; tag?: string; scoreToBeat: number } | null;
  reduced?: boolean;
  onExit: () => void;
  onScoreSubmitted?: (score: number) => void;
}

type FlightPhase = "ready" | "rolling" | "flying" | "crashed";

interface BetSlot {
  amount: number;
  active: boolean; // Si ce slot participe au vol en cours
  cashed: boolean;
  cashMult: number;
  winAmount: number;
}

const MIN_BET = 200;
const INITIAL_WALLET = 10000;
const RECHARGE_AMOUNT = 10000;
const QUICK_BETS = [200, 500, 1000, 2000, 5000];

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const fmtMult = (m: number) => `×${m.toFixed(2).replace(".", ",")}`;

/** Fin de vol secrète : distribution réaliste de type Aviator. */
function drawCrashTarget(): number {
  const r = Math.random();
  // 10% de crash très précoce (1.05 à 1.30)
  if (r < 0.10) return 1.05 + Math.random() * 0.25;
  // 65% de vols modérés (1.30 à 4.50)
  if (r < 0.75) return 1.30 + Math.pow(Math.random(), 1.4) * 3.20;
  // 20% de bons vols (4.50 à 12.00)
  if (r < 0.95) return 4.50 + Math.pow(Math.random(), 1.6) * 7.50;
  // 5% de gros multiplicateurs (12.00 à 35.00+)
  return 12.00 + Math.random() * 25.00;
}

function WhatsAppIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

export default function EnvolGameView({
  playerName,
  playerTag,
  opponent,
  reduced = false,
  onExit,
  onScoreSubmitted
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Envol3D | null>(null);

  // Portefeuille virtuel (CDF fictifs)
  const [wallet, setWallet] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("bloc_envol_wallet_cdf");
      if (saved !== null) {
        const val = Number(saved);
        if (Number.isFinite(val) && val >= 0) return val;
      }
    } catch {}
    return INITIAL_WALLET;
  });

  // Sauvegarde persistante du portefeuille
  const updateWallet = useCallback((fn: (curr: number) => number) => {
    setWallet((prev) => {
      const next = Math.max(0, Math.round(fn(prev)));
      try {
        localStorage.setItem("bloc_envol_wallet_cdf", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Historique des derniers multiplicateurs (pastilles comme Aviator)
  const [history, setHistory] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("bloc_envol_history");
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, 15);
      }
    } catch {}
    return [1.45, 2.80, 1.12, 4.60, 1.88, 12.40, 2.10, 1.05];
  });

  const recordMultHistory = useCallback((m: number) => {
    setHistory((prev) => {
      const next = [Number(m.toFixed(2)), ...prev].slice(0, 20);
      try {
        localStorage.setItem("bloc_envol_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Mises configurées
  const [hasSecondBet, setHasSecondBet] = useState(false);
  const [bet1, setBet1] = useState<BetSlot>({
    amount: 500,
    active: false,
    cashed: false,
    cashMult: 0,
    winAmount: 0
  });
  const [bet2, setBet2] = useState<BetSlot>({
    amount: 200,
    active: false,
    cashed: false,
    cashMult: 0,
    winAmount: 0
  });

  // État du vol
  const [phase, setPhase] = useState<FlightPhase>("ready");
  const [mult, setMult] = useState(1);
  const [alt, setAlt] = useState(0);
  const [planeReady, setPlaneReady] = useState(true);
  const [showBoard, setShowBoard] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [bestWinSession, setBestWinSession] = useState(0);
  const [lastRoundSummary, setLastRoundSummary] = useState<{
    crashMult: number;
    totalWon: number;
    totalBet: number;
    net: number;
  } | null>(null);

  // Audio
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("bloc_envol_muted") === "true";
    } catch {
      return false;
    }
  });

  const engineAudio = useRef<HTMLAudioElement | null>(null);
  const secureAudio = useRef<HTMLAudioElement | null>(null);

  // Refs accessibles dans les callbacks du moteur
  const multRef = useRef(mult);
  multRef.current = mult;
  const bet1Ref = useRef(bet1);
  bet1Ref.current = bet1;
  const bet2Ref = useRef(bet2);
  bet2Ref.current = bet2;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  /* ------------------------------ Audio Init ------------------------------ */
  useEffect(() => {
    const a = new Audio("/game3d/envol243/engine.mp3");
    a.loop = true;
    a.preload = "auto";
    const b = new Audio("/game3d/envol243/secure.mp3");
    b.preload = "auto";
    engineAudio.current = a;
    secureAudio.current = b;
    return () => {
      a.pause();
      b.pause();
    };
  }, []);

  useEffect(() => {
    if (engineAudio.current) engineAudio.current.volume = muted ? 0 : 0.55;
    if (secureAudio.current) secureAudio.current.volume = muted ? 0 : 0.9;
    try {
      localStorage.setItem("bloc_envol_muted", String(muted));
    } catch {}
  }, [muted]);

  /* ---------------------------- Moteur 3D ---------------------------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const engine = new Envol3D(cv, {
      onReady: () => setPlaneReady(true),
      onMultiplierUpdate: (m, a) => {
        setMult(m);
        setAlt(a);
        setPhase((p) => (p === "rolling" && a > 0.3 ? "flying" : p));
        const au = engineAudio.current;
        if (au) au.playbackRate = Math.min(1.95, 0.95 + (m - 1) * 0.15);
      },
      onFlightCrash: (crashMult) => {
        const au = engineAudio.current;
        if (au) {
          au.pause();
          au.currentTime = 0;
        }
        setPhase("crashed");
        setMult(crashMult);
        recordMultHistory(crashMult);

        // Bilan financier de la manche
        const b1 = bet1Ref.current;
        const b2 = bet2Ref.current;
        const totalBet = (b1.active ? b1.amount : 0) + (b2.active ? b2.amount : 0);
        const totalWon = (b1.cashed ? b1.winAmount : 0) + (b2.cashed ? b2.winAmount : 0);
        const net = totalWon - totalBet;

        setLastRoundSummary({
          crashMult,
          totalWon,
          totalBet,
          net
        });

        // Envoi au classement si gain
        if (totalWon > 0) {
          setBestWinSession((prev) => Math.max(prev, totalWon));
          fetch("/api/jeux/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              game: "envol",
              score: totalWon,
              details: {
                mult: Number(crashMult.toFixed(2)),
                bet1: b1.active ? { amount: b1.amount, cashed: b1.cashed, win: b1.winAmount } : null,
                bet2: b2.active ? { amount: b2.amount, cashed: b2.cashed, win: b2.winAmount } : null
              },
              nonce: `envol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            })
          })
            .then((r) => r.json())
            .then((res) => {
              if (res?.success) onScoreSubmitted?.(totalWon);
            })
            .catch(() => {});
        }
      }
    });

    engine.setReduced(reduced);
    engine.startLoop();
    engineRef.current = engine;

    const ro = new ResizeObserver(() => engine.resize(cv.clientWidth, cv.clientHeight));
    ro.observe(cv);

    return () => {
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => engineRef.current?.setReduced(reduced), [reduced]);

  /* ------------------------- Actions de Jeu ------------------------- */

  // Décollage : validation et prélèvement des mises
  const handleTakeoff = useCallback(() => {
    if (phase !== "ready" || !planeReady) return;

    const need1 = bet1.amount;
    const need2 = hasSecondBet ? bet2.amount : 0;
    const totalNeeded = need1 + need2;

    if (wallet < totalNeeded) {
      setShowRechargeModal(true);
      return;
    }

    // Débit du portefeuille
    updateWallet((w) => w - totalNeeded);

    // Initialisation des slots pour ce vol
    setBet1((b) => ({ ...b, active: true, cashed: false, winAmount: 0, cashMult: 0 }));
    setBet2((b) => ({ ...b, active: hasSecondBet, cashed: false, winAmount: 0, cashMult: 0 }));

    setPhase("rolling");
    setMult(1);
    setAlt(0);
    setLastRoundSummary(null);

    const au = engineAudio.current;
    if (au && !mutedRef.current) {
      au.playbackRate = 0.95;
      au.play().catch(() => {});
    }

    engineRef.current?.startFlight(drawCrashTarget());
  }, [phase, planeReady, bet1.amount, bet2.amount, hasSecondBet, wallet, updateWallet]);

  // Encaissement (Cashout) pour le slot 1
  const handleCashout1 = useCallback(() => {
    if (phase !== "flying" || !bet1.active || bet1.cashed) return;
    const currentMult = multRef.current;
    const win = Math.floor(bet1.amount * currentMult);

    setBet1((b) => ({
      ...b,
      cashed: true,
      cashMult: currentMult,
      winAmount: win
    }));

    updateWallet((w) => w + win);
    engineRef.current?.celebrateCashout();

    if (secureAudio.current && !mutedRef.current) {
      secureAudio.current.currentTime = 0;
      secureAudio.current.play().catch(() => {});
    }
  }, [phase, bet1.active, bet1.cashed, bet1.amount, updateWallet]);

  // Encaissement (Cashout) pour le slot 2
  const handleCashout2 = useCallback(() => {
    if (phase !== "flying" || !bet2.active || bet2.cashed) return;
    const currentMult = multRef.current;
    const win = Math.floor(bet2.amount * currentMult);

    setBet2((b) => ({
      ...b,
      cashed: true,
      cashMult: currentMult,
      winAmount: win
    }));

    updateWallet((w) => w + win);
    engineRef.current?.celebrateCashout();

    if (secureAudio.current && !mutedRef.current) {
      secureAudio.current.currentTime = 0;
      secureAudio.current.play().catch(() => {});
    }
  }, [phase, bet2.active, bet2.cashed, bet2.amount, updateWallet]);

  // Préparation du vol suivant
  const handleNextFlight = useCallback(() => {
    engineRef.current?.reset();
    setPhase("ready");
    setMult(1);
    setAlt(0);
    setLastRoundSummary(null);
    setBet1((b) => ({ ...b, active: false, cashed: false, winAmount: 0, cashMult: 0 }));
    setBet2((b) => ({ ...b, active: false, cashed: false, winAmount: 0, cashMult: 0 }));
  }, []);

  // Recharge gratuite du solde fictif
  const handleRecharge = () => {
    updateWallet((w) => w + RECHARGE_AMOUNT);
    setShowRechargeModal(false);
  };

  // Clavier : Espace = décollage ou encaissement rapide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showBoard || showRechargeModal || (e.key !== " " && e.key !== "Enter")) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (phase === "ready") handleTakeoff();
      else if (phase === "flying") {
        if (!bet1.cashed) handleCashout1();
        else if (hasSecondBet && !bet2.cashed) handleCashout2();
      } else if (phase === "crashed") {
        handleNextFlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, bet1.cashed, bet2.cashed, hasSecondBet, showBoard, showRechargeModal, handleTakeoff, handleCashout1, handleCashout2, handleNextFlight]);

  const shareWhatsApp = () => {
    const totalWon = lastRoundSummary?.totalWon || bestWinSession;
    const text = opponent
      ? t("✈️ {name}, j'ai encaissé {n} CDF fictifs sur Envol 243 à Kinshasa (Bloc Léopards) ! À toi de tester ton timing 🐆", { name: opponent.name, n: fmt(totalWon) })
      : t("✈️ J'ai encaissé {n} CDF virtuels à une cote de {m} sur Envol 243 ! Relève le défi 🐆", { n: fmt(totalWon), m: fmtMult(lastRoundSummary?.crashMult || mult) });
    const url = `${window.location.origin}/jeux/envol`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  const inFlight = phase === "rolling" || phase === "flying";

  return (
    <div className="arena envol relative h-full w-full select-none overflow-hidden bg-[#070e24] text-white">
      {/* Canevas 3D */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label={t("Vol 3D au-dessus de Kinshasa")} />

      {/* Dégradés d'ambiance haut & bas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[rgba(5,10,28,0.85)] via-[rgba(5,10,28,0.4)] to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[rgba(5,10,28,0.92)] via-[rgba(5,10,28,0.6)] to-transparent" aria-hidden="true" />

      {/* --------------------------- BARRE SUPÉRIEURE & HISTORIQUE --------------------------- */}
      <header className="safe-top absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-3">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Sortie */}
          <button type="button" className="envol-icon shrink-0" onClick={onExit} aria-label={t("Quitter Envol 243")}>
            <ArrowLeft size={19} />
          </button>

          {/* Identité joueur */}
          <div className="envol-glass min-w-0 flex-1 px-2.5 py-1 sm:px-3 sm:py-1.5">
            <div className="truncate text-[11px] font-black leading-tight sm:text-[13px]">
              {playerName} <span className="font-mono text-[10px] text-[var(--a-gold)] sm:text-[11px]">#{playerTag}</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 sm:text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">{t("Démo · Fictif")}</span>
            </div>
          </div>

          {/* Portefeuille Fictif */}
          <div className="envol-glass flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 shrink-0">
            <div className="text-right">
              <div className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[var(--a-gold)] sm:text-[9px]">{t("Portefeuille")}</div>
              <div className="text-[13px] font-black leading-tight tabular-nums sm:text-[16px] text-amber-300">
                {fmt(wallet)} <span className="text-[9px] font-bold text-white/70 sm:text-[10px]">CDF</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRechargeModal(true)}
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors"
              title={t("Recharger le portefeuille gratuitement")}
              aria-label={t("Recharger le portefeuille")}
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Trophée Classement & Son */}
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="envol-icon text-[var(--a-gold)]" onClick={() => setShowBoard(true)} aria-label={t("Voir le classement des champions")}>
              <Trophy size={18} />
            </button>
            <button type="button" className="envol-icon" onClick={() => setMuted((m) => !m)} aria-label={muted ? t("Activer le son") : t("Couper le son")}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        {/* --------------------- RUBAN HISTORIQUE MULTIPLICATEURS --------------------- */}
        <div className="flex items-center justify-center px-1">
          <div className="envol-history-scroll max-w-xl w-full">
            {history.map((h, i) => {
              const cls = h >= 10 ? "is-gold" : h >= 2 ? "is-purple" : "is-blue";
              return (
                <span key={`${i}-${h}`} className={`envol-badge-mult ${cls}`}>
                  {fmtMult(h)}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* --------------------------- MULTIPLICATEUR EN VOL --------------------------- */}
      {inFlight && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] z-10 flex flex-col items-center" aria-live="off">
          <div className={`envol-mult tabular-nums ${mult >= 3 ? "is-hot" : ""}`}>{fmtMult(mult)}</div>
          <div className="mt-1 rounded-full bg-black/40 px-3.5 py-1 text-[12px] font-bold text-white/90 backdrop-blur-md">
            {phase === "rolling" ? t("Roulage sur le Boulevard du 30 Juin…") : t("Altitude {n} m · Fleuve Congo en vue", { n: Math.round(alt * 4) })}
          </div>
        </div>
      )}

      {/* ------------------------- L'AVION S'EST ENVOLÉ (CRASH) ------------------------- */}
      {phase === "crashed" && (
        <div className="absolute inset-x-0 top-[26%] z-10 flex justify-center px-4" role="status">
          <div className="envol-result is-lost flex flex-col items-center text-center p-4">
            <span className="display text-[32px] sm:text-[38px] text-red-400 leading-none">
              {t("L'AVION S'EST ENVOLÉ !")}
            </span>
            <div className="mt-1 text-[18px] font-black text-white tabular-nums">
              {t("Échappé à")}{" "}<span className="text-red-400">{fmtMult(mult)}</span>
            </div>
            {lastRoundSummary && (
              <div className="mt-2 text-[12px] font-semibold text-white/80">
                {lastRoundSummary.totalWon > 0 ? (
                  <span className="text-emerald-400">{t("Gains sécurisés : +{n} CDF", { n: fmt(lastRoundSummary.totalWon) })}</span>
                ) : (
                  <span className="text-red-300">{t("Mise non encaissée perdue (-{n} CDF)", { n: fmt(lastRoundSummary.totalBet) })}</span>
                )}
              </div>
            )}
            <button
              type="button"
              className="a-btn a-btn-primary mt-3 text-[14px] px-5 py-2"
              onClick={handleNextFlight}
              autoFocus
            >
              <RotateCcw size={15} />{" "}{t("Vol Suivant")}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------- PANNEAUX DE MISES (STYLE AVIATOR) --------------------------- */}
      <footer className="safe-bottom absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-4">
        <div className="mx-auto max-w-xl flex flex-col gap-2">
          {/* Bouton pour activer / désactiver la 2ème mise (double mise) */}
          {phase === "ready" && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                {t("Mises en CDF virtuels (Min. {n} CDF)", { n: MIN_BET })}
              </span>
              <button
                type="button"
                onClick={() => setHasSecondBet((v) => !v)}
                className="text-[11px] font-extrabold text-[var(--a-gold)] hover:underline flex items-center gap-1"
              >
                {hasSecondBet ? t("− Retirer la 2e mise") : t("+ Activer la double mise")}
              </button>
            </div>
          )}

          {/* Grille des 1 ou 2 mises */}
          <div className={`grid gap-2 ${hasSecondBet ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {/* PANNEAU MISE 1 */}
            <div className={`envol-bet-card ${bet1.active && !bet1.cashed ? "is-active-bet" : bet1.cashed ? "is-cashed" : ""}`}>
              <div className="flex items-center justify-between text-[11px] font-extrabold text-white/70 mb-1.5">
                <span>{t("Mise 1")}</span>
                {phase === "flying" && bet1.active && !bet1.cashed && (
                  <span className="text-emerald-400 font-black animate-pulse">
                    {t("Gain : {n} CDF", { n: fmt(bet1.amount * mult) })}
                  </span>
                )}
                {bet1.cashed && (
                  <span className="text-amber-300 font-black">
                    {t("Encaissé : +{n} CDF ({m})", { n: fmt(bet1.winAmount), m: fmtMult(bet1.cashMult) })}
                  </span>
                )}
              </div>

              {/* Ajustement du montant avant vol */}
              {phase === "ready" && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setBet1((b) => ({ ...b, amount: Math.max(MIN_BET, b.amount - 100) }))}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white"
                      aria-label={t("Diminuer la mise 1")}
                    >
                      <Minus size={14} />
                    </button>
                    <div className="flex-1 text-center font-mono text-[16px] font-black text-amber-300 bg-black/30 rounded-lg py-1">
                      {fmt(bet1.amount)} <span className="text-[11px] font-sans font-bold text-white/60">CDF</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBet1((b) => ({ ...b, amount: Math.min(wallet, b.amount + 100) }))}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white"
                      aria-label={t("Augmenter la mise 1")}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Chips de mise rapide */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    {QUICK_BETS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBet1((b) => ({ ...b, amount: Math.min(wallet, amt) }))}
                        className="envol-quick-chip flex-1 text-center"
                      >
                        {amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Bouton d'action pour Mise 1 */}
              {phase === "ready" && !hasSecondBet && (
                <button
                  type="button"
                  className="envol-cta is-gold w-full min-h-[50px] text-[16px]"
                  onClick={handleTakeoff}
                  disabled={!planeReady || wallet < bet1.amount}
                >
                  <Plane size={18} />
                  <span>{planeReady ? t("Décoller ({n} CDF)", { n: fmt(bet1.amount) }) : t("Préparation…")}</span>
                </button>
              )}

              {phase === "flying" && bet1.active && !bet1.cashed && (
                <button
                  type="button"
                  className="envol-btn-cashout"
                  onClick={handleCashout1}
                  autoFocus
                >
                  <span className="text-[16px] uppercase tracking-wide">{t("Encaisser")}</span>
                  <span className="text-[13px] font-bold text-amber-200">
                    {fmt(bet1.amount * mult)} CDF ({fmtMult(mult)})
                  </span>
                </button>
              )}

              {bet1.cashed && (
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-[13px] border border-emerald-500/40">
                  <CheckCircle2 size={16} /> {t("Encaissé : +{n} CDF", { n: fmt(bet1.winAmount) })}
                </div>
              )}

              {phase === "crashed" && bet1.active && !bet1.cashed && (
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-bold text-[13px] border border-red-500/40">
                  <XCircle size={16} /> {t("Non encaissé (-{n} CDF)", { n: fmt(bet1.amount) })}
                </div>
              )}
            </div>

            {/* PANNEAU MISE 2 (Si activée) */}
            {hasSecondBet && (
              <div className={`envol-bet-card ${bet2.active && !bet2.cashed ? "is-active-bet" : bet2.cashed ? "is-cashed" : ""}`}>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-white/70 mb-1.5">
                  <span>{t("Mise 2")}</span>
                  {phase === "flying" && bet2.active && !bet2.cashed && (
                    <span className="text-emerald-400 font-black animate-pulse">
                      {t("Gain : {n} CDF", { n: fmt(bet2.amount * mult) })}
                    </span>
                  )}
                  {bet2.cashed && (
                    <span className="text-amber-300 font-black">
                      {t("Encaissé : +{n} CDF ({m})", { n: fmt(bet2.winAmount), m: fmtMult(bet2.cashMult) })}
                    </span>
                  )}
                </div>

                {/* Ajustement du montant avant vol */}
                {phase === "ready" && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setBet2((b) => ({ ...b, amount: Math.max(MIN_BET, b.amount - 100) }))}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white"
                        aria-label={t("Diminuer la mise 2")}
                      >
                        <Minus size={14} />
                      </button>
                      <div className="flex-1 text-center font-mono text-[16px] font-black text-amber-300 bg-black/30 rounded-lg py-1">
                        {fmt(bet2.amount)} <span className="text-[11px] font-sans font-bold text-white/60">CDF</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBet2((b) => ({ ...b, amount: Math.min(wallet, b.amount + 100) }))}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white"
                        aria-label={t("Augmenter la mise 2")}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Chips rapides */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {QUICK_BETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setBet2((b) => ({ ...b, amount: Math.min(wallet, amt) }))}
                          className="envol-quick-chip flex-1 text-center"
                        >
                          {amt >= 1000 ? `${amt / 1000}k` : amt}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Bouton d'action pour Mise 2 */}
                {phase === "flying" && bet2.active && !bet2.cashed && (
                  <button
                    type="button"
                    className="envol-btn-cashout"
                    onClick={handleCashout2}
                  >
                    <span className="text-[16px] uppercase tracking-wide">{t("Encaisser")}</span>
                    <span className="text-[13px] font-bold text-amber-200">
                      {fmt(bet2.amount * mult)} CDF ({fmtMult(mult)})
                    </span>
                  </button>
                )}

                {bet2.cashed && (
                  <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-[13px] border border-emerald-500/40">
                    <CheckCircle2 size={16} /> {t("Encaissé : +{n} CDF", { n: fmt(bet2.winAmount) })}
                  </div>
                )}

                {phase === "crashed" && bet2.active && !bet2.cashed && (
                  <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-bold text-[13px] border border-red-500/40">
                    <XCircle size={16} /> {t("Non encaissé (-{n} CDF)", { n: fmt(bet2.amount) })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bouton de décollage global si 2 mises sont actives */}
          {phase === "ready" && hasSecondBet && (
            <button
              type="button"
              className="envol-cta is-gold w-full min-h-[52px] text-[17px]"
              onClick={handleTakeoff}
              disabled={!planeReady || wallet < bet1.amount + bet2.amount}
            >
              <Plane size={19} />
              <span>
                {planeReady
                  ? t("Décoller · Mises cumulées : {n} CDF", { n: fmt(bet1.amount + bet2.amount) })
                  : t("Préparation de l'avion…")}
              </span>
            </button>
          )}

          {/* Roulage en cours */}
          {phase === "rolling" && (
            <div className="envol-glass py-2.5 text-center text-[13px] font-bold text-amber-300">
              {t("Décollage en cours… L'avion prend de la vitesse sur le Boulevard !")}
            </div>
          )}

          {/* Partage et défi entre amis après un vol */}
          {phase === "crashed" && (
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                className="a-btn a-btn-whatsapp flex-1 text-[13px] py-2"
                onClick={shareWhatsApp}
              >
                <WhatsAppIcon />{" "}{t("Partager mon vol")}
              </button>
              <button
                type="button"
                className="a-btn a-btn-secondary px-3 py-2 text-[13px]"
                onClick={() => setShowBoard(true)}
              >
                <Trophy size={15} />{" "}{t("Champions")}
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* --------------------------- MODAL RECHARGE GRATUITE --------------------------- */}
      {showRechargeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="envol-sheet max-w-sm w-full p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-[var(--a-gold)]">
              <Coins size={30} />
            </div>
            <h3 className="display text-[26px] mt-3 text-[var(--a-gold)] leading-tight">
              {t("Portefeuille Léopard")}
            </h3>
            <p className="mt-2 text-[13px] text-white/75 leading-relaxed">
              {t("Ce jeu fonctionne exclusivement avec de l'argent fictif pour le plaisir et les défis entre supporters.")}
            </p>
            <div className="mt-4 rounded-xl bg-white/5 p-3 text-[14px] font-bold text-amber-200">
              {t("Solde actuel : {n} CDF", { n: fmt(wallet) })}
            </div>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                className="a-btn a-btn-primary w-full text-[15px]"
                onClick={handleRecharge}
              >
                <Sparkles size={16} /> {t("Recharger +{n} CDF (Gratuit)", { n: fmt(RECHARGE_AMOUNT) })}
              </button>
              <button
                type="button"
                className="a-btn a-btn-ghost w-full text-[13px]"
                onClick={() => setShowRechargeModal(false)}
              >
                {t("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------- MODAL CLASSEMENT DES CHAMPIONS --------------------- */}
      {showBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <ChampionsLeaderboard
            initialGame="envol"
            allowedGames={["envol"]}
            onClose={() => setShowBoard(false)}
            onPlayGame={() => setShowBoard(false)}
          />
        </div>
      )}
    </div>
  );
}
