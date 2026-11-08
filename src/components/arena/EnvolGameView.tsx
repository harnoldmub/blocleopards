import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Trophy, ArrowLeft, RefreshCw, Share2, Flame, Award, ShieldCheck, AlertTriangle } from "lucide-react";
import { Envol3D } from "./engine/envol3d";
import ChampionsLeaderboard from "./ChampionsLeaderboard";

interface Props {
  playerName: string;
  playerTag: string;
  opponent?: { name: string; tag?: string; scoreToBeat: number } | null;
  onExit: () => void;
  onScoreSubmitted?: (score: number) => void;
}

export default function EnvolGameView({
  playerName,
  playerTag,
  opponent,
  onExit,
  onScoreSubmitted
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Envol3D | null>(null);

  // Audio
  const [muted, setMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bloc_envol_muted") === "true";
    }
    return false;
  });
  const audioEngineRef = useRef<HTMLAudioElement | null>(null);
  const audioSecureRef = useRef<HTMLAudioElement | null>(null);

  // État du match (3 vols par session)
  const [round, setRound] = useState(1); // 1, 2, 3
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [flightState, setFlightState] = useState<"ready" | "flying" | "secured" | "crashed" | "gameover">("ready");
  const [currentMult, setCurrentMult] = useState(1.0);
  const [lastFlightResult, setLastFlightResult] = useState<{ secured: boolean; score: number; mult: number } | null>(null);

  // Sauvegarde & classement
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    totalScore: number;
    bestScore: number;
    rankAllTime: number;
    rankWeek: number;
    challengeUrl: string;
  } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Initialisation audio
  useEffect(() => {
    const aEng = new Audio("/game3d/envol243/engine.mp3");
    aEng.loop = true;
    aEng.volume = muted ? 0 : 0.6;
    audioEngineRef.current = aEng;

    const aSec = new Audio("/game3d/envol243/secure.mp3");
    aSec.volume = muted ? 0 : 0.9;
    audioSecureRef.current = aSec;

    return () => {
      aEng.pause();
      aSec.pause();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("bloc_envol_muted", String(next));
    if (audioEngineRef.current) audioEngineRef.current.volume = next ? 0 : 0.6;
    if (audioSecureRef.current) audioSecureRef.current.volume = next ? 0 : 0.9;
  };

  // Initialisation du moteur 3D
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new Envol3D(canvasRef.current, {
      onMultiplierUpdate: (mult) => {
        setCurrentMult(mult);
        if (audioEngineRef.current && !muted) {
          // Accélération du pitch audio liée au multiplicateur
          audioEngineRef.current.playbackRate = Math.min(1.8, 0.9 + (mult - 1) * 0.15);
        }
      },
      onFlightEnd: (secured, score, mult) => {
        if (audioEngineRef.current) {
          audioEngineRef.current.pause();
          audioEngineRef.current.currentTime = 0;
        }

        if (secured) {
          if (audioSecureRef.current && !muted) {
            audioSecureRef.current.currentTime = 0;
            audioSecureRef.current.play().catch(() => {});
          }
          setFlightState("secured");
        } else {
          setFlightState("crashed");
        }

        setLastFlightResult({ secured, score, mult });
        const newScores = [...roundScores, score];
        setRoundScores(newScores);

        // Si 3e vol terminé : match achevé
        if (round >= 3) {
          handleMatchOver(newScores);
        }
      }
    });

    engine.startLoop();
    engineRef.current = engine;

    const handleResize = () => {
      if (canvasRef.current) {
        engine.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      engine.dispose();
    };
  }, [roundScores, round, muted]);

  // Décollage
  const handleTakeoff = () => {
    if (flightState === "flying") return;

    // Génération d'un multiplicateur de fin secret (courbe exponentielle avec espérance réaliste)
    // 10% de chances de crash rapide (< 1.5), 70% entre 1.5 et 5.0, 20% au-delà de 5.0
    const rand = Math.random();
    let crashTarget: number;
    if (rand < 0.12) {
      crashTarget = 1.1 + Math.random() * 0.4;
    } else if (rand < 0.8) {
      crashTarget = 1.5 + Math.pow(Math.random(), 1.5) * 4.0;
    } else {
      crashTarget = 5.5 + Math.random() * 7.5;
    }

    setFlightState("flying");
    setCurrentMult(1.0);
    setLastFlightResult(null);

    if (audioEngineRef.current && !muted) {
      audioEngineRef.current.playbackRate = 1.0;
      audioEngineRef.current.play().catch(() => {});
    }

    engineRef.current?.startFlight(crashTarget);
  };

  // Sécuriser les points
  const handleSecure = () => {
    if (flightState !== "flying") return;
    engineRef.current?.securePoints();
  };

  // Passage au vol suivant
  const handleNextFlight = () => {
    if (round < 3) {
      setRound(round + 1);
      setFlightState("ready");
      setCurrentMult(1.0);
      setLastFlightResult(null);
    }
  };

  // Enregistrement final côté serveur (somme des 3 vols)
  const handleMatchOver = async (scores: number[]) => {
    setFlightState("gameover");
    setSubmitting(true);
    const total = scores.reduce((a, b) => a + b, 0);

    try {
      const res = await fetch("/api/jeux/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "envol",
          score: total,
          details: { rounds: scores },
          nonce: `envol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFinalResult({
            totalScore: total,
            bestScore: data.result.bestScore,
            rankAllTime: data.result.rankAllTime,
            rankWeek: data.result.rankWeek,
            challengeUrl: data.challengeUrl
          });
          onScoreSubmitted?.(total);
        }
      }
    } catch (e) {
      console.error("Erreur enregistrement Envol 243:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCurrentScore = roundScores.reduce((a, b) => a + b, 0);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#060b18]">
      {/* Canvas 3D */}
      <canvas ref={canvasRef} className="h-full w-full object-cover" />

      {/* Header HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onExit}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/40 text-white/80 backdrop-blur-md transition-all hover:bg-black/60 active:scale-95 shadow-md"
            aria-label="Quitter"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="rounded-2xl border border-white/10 bg-black/40 px-3.5 py-1.5 backdrop-blur-md shadow-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Supporter</div>
            <div className="flex items-center gap-1.5 text-[13px] font-black text-white">
              <span>{playerName}</span>
              <span className="font-mono text-[11px] text-[var(--a-gold)]">#{playerTag}</span>
            </div>
          </div>
        </div>

        {/* Score & Manches */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-2xl border border-[var(--a-gold)]/30 bg-black/50 px-4 py-1.5 text-right backdrop-blur-md shadow-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--a-gold)]">
              Vol {round}/3 · Total
            </div>
            <div className="text-[17px] font-black text-white">
              {totalCurrentScore.toLocaleString("fr-FR")} <span className="text-[11px] text-white/60">pts</span>
            </div>
          </div>

          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/40 text-[var(--a-gold)] backdrop-blur-md transition-all hover:bg-black/60 active:scale-95 shadow-md"
            aria-label="Voir le classement"
          >
            <Trophy className="h-5 w-5" />
          </button>

          <button
            onClick={toggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/40 text-white/80 backdrop-blur-md transition-all hover:bg-black/60 active:scale-95 shadow-md"
            aria-label={muted ? "Activer le son" : "Couper le son"}
          >
            {muted ? <VolumeX className="h-5 w-5 text-red-400" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Défi Adverse (si présent) */}
      {opponent && flightState !== "gameover" && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center">
          <div className="rounded-full border border-amber-500/40 bg-black/60 px-4 py-1 backdrop-blur-md text-center shadow-lg">
            <span className="text-[11px] font-bold text-white/70">
              Défi de <strong className="text-white">{opponent.name}</strong> · Score à battre :{" "}
              <strong className="text-[var(--a-gold)]">{opponent.scoreToBeat} pts</strong>
            </span>
          </div>
        </div>
      )}

      {/* Centre : Affichage du Multiplicateur de Vol */}
      {flightState === "flying" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="rounded-full bg-black/30 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-md">
              Multiplicateur en vol
            </span>
            <div className="mt-1 text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] sm:text-7xl">
              ×{currentMult.toFixed(2)}
            </div>
            <div className="mt-1 text-[15px] font-black text-[var(--a-gold)] drop-shadow-md">
              {Math.floor(100 * currentMult)} pts potentiels
            </div>
          </div>
        </div>
      )}

      {/* Message Résultat Vol (Crash ou Sécurisé) */}
      {(flightState === "secured" || flightState === "crashed") && lastFlightResult && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
          <div className={`flex flex-col items-center rounded-3xl border p-6 text-center shadow-2xl backdrop-blur-xl ${
            lastFlightResult.secured
              ? "border-emerald-500/50 bg-emerald-950/70"
              : "border-red-500/50 bg-red-950/70"
          }`}>
            {lastFlightResult.secured ? (
              <>
                <ShieldCheck className="h-12 w-12 text-emerald-400" />
                <h3 className="mt-2 text-2xl font-black text-white">Points sécurisés !</h3>
                <p className="mt-1 text-[15px] font-extrabold text-emerald-300">
                  +{lastFlightResult.score} pts (×{lastFlightResult.mult.toFixed(2)})
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-red-400" />
                <h3 className="mt-2 text-2xl font-black text-white">Vol terminé</h3>
                <p className="mt-1 text-[13px] font-medium text-white/70">
                  L'avion a disparu dans les nuages avant sécurisation.
                </p>
                <p className="mt-1 text-[15px] font-black text-red-300">0 point</p>
              </>
            )}

            {round < 3 && (
              <button
                type="button"
                onClick={handleNextFlight}
                className="pointer-events-auto mt-4 rounded-xl bg-[var(--a-gold)] px-6 py-2.5 text-[14px] font-black text-[#1a1300] shadow-lg hover:brightness-110 active:scale-95"
              >
                Vol suivant ({round + 1}/3)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panneau Bas : Bouton d'action principal */}
      {flightState !== "gameover" && flightState !== "secured" && flightState !== "crashed" && (
        <footer className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
          {flightState === "ready" ? (
            <button
              type="button"
              onClick={handleTakeoff}
              className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-[var(--a-gold)] to-yellow-500 px-8 py-4 text-[17px] font-black text-[#1a1300] shadow-[0_4px_24px_rgba(244,196,0,0.45)] transition-all hover:scale-[1.02] active:scale-95"
            >
              <span>Décoller (Vol {round}/3)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSecure}
              className="flex w-full max-w-sm flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-white shadow-[0_4px_24px_rgba(16,185,129,0.45)] transition-all active:scale-95"
            >
              <span className="text-[17px] font-black">
                Sécuriser {Math.floor(100 * currentMult)} pts
              </span>
              <span className="text-[12px] font-bold text-white/80">
                (à ×{currentMult.toFixed(2)})
              </span>
            </button>
          )}
        </footer>
      )}

      {/* Écran Match Terminé (Après les 3 vols) */}
      {flightState === "gameover" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative flex w-full max-w-md flex-col rounded-3xl border border-white/10 bg-[#091124] p-6 text-center text-white shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--a-gold)]/20 text-[var(--a-gold)] shadow-lg">
              <Trophy className="h-7 w-7" />
            </div>

            <h2 className="mt-3 text-2xl font-black">Mission Envol 243 terminée !</h2>
            <p className="text-[13px] text-white/60">Voici le récapitulatif de tes 3 vols au-dessus de Kinshasa</p>

            {/* Détail des 3 vols */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-left">
              {[0, 1, 2].map((idx) => {
                const s = roundScores[idx] ?? 0;
                return (
                  <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <div className="text-[11px] font-bold text-white/40 uppercase">Vol {idx + 1}</div>
                    <div className={`mt-1 text-[15px] font-black ${s > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {s > 0 ? `${s} pts` : "0 pt"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total général */}
            <div className="mt-4 rounded-2xl border border-[var(--a-gold)]/40 bg-[var(--a-gold)]/10 p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--a-gold)]">
                Score Total Définitif
              </div>
              <div className="mt-0.5 text-4xl font-black text-white">
                {totalCurrentScore.toLocaleString("fr-FR")} <span className="text-[14px] text-white/60">points</span>
              </div>
            </div>

            {/* Rangs dans Les Champions du Bloc */}
            {finalResult && (
              <div className="mt-3 flex items-center justify-around rounded-xl bg-black/30 p-2.5 text-[12px]">
                <div>
                  <span className="text-white/40">Rang semaine :</span>{" "}
                  <strong className="text-[var(--a-gold)]">{finalResult.rankWeek}e</strong>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div>
                  <span className="text-white/40">Tous les temps :</span>{" "}
                  <strong className="text-[var(--a-gold)]">{finalResult.rankAllTime}e</strong>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const origin = window.location.origin;
                  const shareText = `✈️ J'ai marqué ${totalCurrentScore} points sur Envol 243 (Bloc Léopards) ! Peux-tu faire mieux sur tes 3 vols au-dessus de Kinshasa ? Relever le défi : ${finalResult?.challengeUrl || origin + "/jeux"}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[14px] font-black text-white shadow-md hover:bg-emerald-500 active:scale-95"
              >
                <Share2 className="h-4 w-4" />
                <span>Défier un ami sur WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRound(1);
                    setRoundScores([]);
                    setFlightState("ready");
                    setLastFlightResult(null);
                    setFinalResult(null);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-[13px] font-black text-white hover:bg-white/15 active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Rejouer (3 vols)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLeaderboard(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--a-gold)] py-2.5 text-[13px] font-black text-[#1a1300] hover:brightness-110 active:scale-95"
                >
                  <Trophy className="h-4 w-4" />
                  <span>Classement</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onExit}
                className="mt-1 text-[12px] font-bold text-white/50 hover:text-white"
              >
                Retour à l'Arène
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Classement « Les champions du Bloc » */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <ChampionsLeaderboard
            initialGame="envol"
            onClose={() => setShowLeaderboard(false)}
            onPlayGame={() => {
              setShowLeaderboard(false);
              setRound(1);
              setRoundScores([]);
              setFlightState("ready");
              setLastFlightResult(null);
              setFinalResult(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
