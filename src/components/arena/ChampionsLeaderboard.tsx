import { useEffect, useState, useId } from "react";
import { Trophy, Medal, Flame, Plane, Disc, Calendar, Award, RefreshCw, Smartphone, User, X } from "lucide-react";
import type { ArenaGame, ChampionEntry, LeaderboardPeriod } from "../../lib/arena/champions";

interface Props {
  initialGame?: ArenaGame;
  allowedGames?: ArenaGame[];
  currentPlayerId?: string | null;
  onClose?: () => void;
  onPlayGame?: (game: ArenaGame) => void;
}

export default function ChampionsLeaderboard({
  initialGame = "foot",
  allowedGames,
  currentPlayerId,
  onClose,
  onPlayGame
}: Props) {
  const availableGames = allowedGames && allowedGames.length > 0
    ? allowedGames
    : (["foot", "basket", "envol"] as ArenaGame[]);
  const startG = availableGames.includes(initialGame) ? initialGame : availableGames[0];
  const [game, setGame] = useState<ArenaGame>(startG);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<ChampionEntry[]>([]);
  const [personal, setPersonal] = useState<ChampionEntry | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const fetchLeaderboard = async (g: ArenaGame, p: LeaderboardPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jeux/leaderboard?game=${g}&period=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTop(data.top || []);
          setPersonal(data.personal || null);
          setTotalPlayers(data.total_players || 0);
        }
      }
    } catch (e) {
      console.error("Erreur chargement classement:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(game, period);
  }, [game, period]);

  const scoreLabel = (g: ArenaGame, s: number) => {
    if (g === "foot") return `${s} ${s > 1 ? "tirs d'affilée" : "tir réussi"}`;
    if (g === "basket") return `${s} ${s > 1 ? "paniers d'affilée" : "panier réussi"}`;
    return `${s.toLocaleString("fr-FR")} CDF (fictif)`;
  };

  const p1 = top[0];
  const p2 = top[1];
  const p3 = top[2];
  const rest = top.slice(3);

  return (
    <div className="relative flex h-full max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[#091124] text-white shadow-2xl ring-1 ring-white/10">
      {/* Header */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-[#141d38] to-[#091124] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--a-gold)]/15 text-[var(--a-gold)] shadow-[inset_0_0_12px_rgba(244,196,0,0.25)]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[19px] font-black tracking-tight text-white">Les champions du Bloc</h2>
              <p className="text-[12px] font-medium text-white/60">Classement officiel vérifié côté serveur</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/70 hover:bg-white/10 active:scale-95"
              aria-label="Fermer le classement"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Sélecteur de Jeu */}
        {availableGames.length > 1 && (
          <div className={`mt-4 grid gap-1.5 rounded-2xl bg-black/30 p-1 ${availableGames.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {availableGames.includes("foot") && (
              <button
                type="button"
                onClick={() => setGame("foot")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-extrabold transition-all ${
                  game === "foot"
                    ? "bg-[var(--a-gold)] text-[#1a1300] shadow-[0_2px_8px_rgba(244,196,0,0.3)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Tirs au but</span>
              </button>
            )}
            {availableGames.includes("basket") && (
              <button
                type="button"
                onClick={() => setGame("basket")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-extrabold transition-all ${
                  game === "basket"
                    ? "bg-[var(--a-gold)] text-[#1a1300] shadow-[0_2px_8px_rgba(244,196,0,0.3)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Disc className="h-3.5 w-3.5" />
                <span>Basket</span>
              </button>
            )}
            {availableGames.includes("envol") && (
              <button
                type="button"
                onClick={() => setGame("envol")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-extrabold transition-all ${
                  game === "envol"
                    ? "bg-[var(--a-gold)] text-[#1a1300] shadow-[0_2px_8px_rgba(244,196,0,0.3)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Plane className="h-3.5 w-3.5" />
                <span>Envol 243</span>
              </button>
            )}
          </div>
        )}

        {/* Filtre Période */}
        <div className="mt-2.5 flex items-center justify-between text-[12px]">
          <span className="font-semibold text-white/50">
            {game === "envol" ? "Meilleur gain en vol (CDF virtuels)" : "Plus longue série d'affilée"}
          </span>
          <div className="inline-flex rounded-xl bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                period === "week" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              Cette semaine
            </button>
            <button
              type="button"
              onClick={() => setPeriod("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                period === "all" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              Tous les temps
            </button>
          </div>
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-white/40">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--a-gold)]" />
            <span className="text-[13px] font-bold">Chargement des scores...</span>
          </div>
        ) : top.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-white/50">
            <Trophy className="h-10 w-10 text-white/20" />
            <p className="text-[14px] font-semibold text-white/70">Aucune partie enregistrée pour cette période.</p>
            <p className="text-[12px] text-white/40">Sois le tout premier à inscrire ton nom au tableau d'honneur !</p>
            {onPlayGame && (
              <button
                type="button"
                onClick={() => onPlayGame(game)}
                className="mt-2 rounded-xl bg-[var(--a-gold)] px-4 py-2 text-[13px] font-black text-[#1a1300] shadow-md hover:brightness-110 active:scale-95"
              >
                Jouer maintenant
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Podium (Top 3) */}
            <div className="mb-6 grid grid-cols-3 items-end gap-2 pt-2 text-center">
              {/* 2e Place */}
              {p2 ? (
                <div className={`relative flex flex-col items-center rounded-2xl border p-2.5 pt-3 transition-all ${
                  p2.is_current_player
                    ? "border-[var(--a-gold)] bg-amber-500/10 shadow-[0_0_15px_rgba(244,196,0,0.2)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 font-black text-slate-900 text-[12px] shadow-md">
                    2
                  </span>
                  <div className="mt-2 text-[13px] font-extrabold truncate max-w-full text-white/90">
                    {p2.nickname}
                  </div>
                  <div className="text-[10px] font-mono text-white/40">#{p2.public_tag}</div>
                  <div className="mt-1.5 text-[12px] font-black text-slate-200">
                    {scoreLabel(game, p2.score)}
                  </div>
                </div>
              ) : <div />}

              {/* 1ère Place (Vainqueur) */}
              {p1 && (
                <div className={`relative flex flex-col items-center rounded-2xl border p-3 pt-4 shadow-lg transition-all ${
                  p1.is_current_player
                    ? "border-[var(--a-gold)] bg-amber-500/15 shadow-[0_0_20px_rgba(244,196,0,0.3)] ring-2 ring-[var(--a-gold)]"
                    : "border-[var(--a-gold)]/40 bg-gradient-to-b from-amber-500/10 to-transparent"
                }`}>
                  <div className="absolute -top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--a-gold)] text-[#1a1300] shadow-[0_0_12px_rgba(244,196,0,0.5)]">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--a-gold)] font-black text-[#1a1300] text-[14px]">
                    1
                  </span>
                  <div className="mt-2 text-[14px] font-black truncate max-w-full text-white">
                    {p1.nickname}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--a-gold)]">#{p1.public_tag}</div>
                  <div className="mt-1.5 text-[13px] font-black text-[var(--a-gold)]">
                    {scoreLabel(game, p1.score)}
                  </div>
                </div>
              )}

              {/* 3e Place */}
              {p3 ? (
                <div className={`relative flex flex-col items-center rounded-2xl border p-2.5 pt-3 transition-all ${
                  p3.is_current_player
                    ? "border-[var(--a-gold)] bg-amber-500/10 shadow-[0_0_15px_rgba(244,196,0,0.2)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 font-black text-white text-[12px] shadow-md">
                    3
                  </span>
                  <div className="mt-2 text-[13px] font-extrabold truncate max-w-full text-white/90">
                    {p3.nickname}
                  </div>
                  <div className="text-[10px] font-mono text-white/40">#{p3.public_tag}</div>
                  <div className="mt-1.5 text-[12px] font-black text-amber-300">
                    {scoreLabel(game, p3.score)}
                  </div>
                </div>
              ) : <div />}
            </div>

            {/* Reste de la liste */}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">
                  Meilleurs supporters
                </span>
                {rest.map((r, i) => {
                  const isCurrent = r.is_current_player;
                  return (
                    <div
                      key={r.player_id + i}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13px] transition-all ${
                        isCurrent
                          ? "border border-[var(--a-gold)]/60 bg-amber-500/15 text-white shadow-[0_0_12px_rgba(244,196,0,0.15)]"
                          : "bg-white/[0.02] hover:bg-white/[0.05] text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 text-center font-black ${isCurrent ? "text-[var(--a-gold)]" : "text-white/40"}`}>
                          {r.rank}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white">{r.nickname}</span>
                          <span className="text-[10px] font-mono text-white/40">#{r.public_tag}</span>
                          {isCurrent && (
                            <span className="ml-1 rounded-md bg-[var(--a-gold)]/20 px-1.5 py-0.5 text-[9px] font-black text-[var(--a-gold)] uppercase">
                              Toi
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-black ${isCurrent ? "text-[var(--a-gold)]" : "text-white/90"}`}>
                        {scoreLabel(game, r.score)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bandeau Position Personnelle */}
      <div className="border-t border-white/10 bg-[#060b18] px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-white/60">
                <span>Ton rang</span>
                {personal && <span className="font-mono text-white/40">#{personal.public_tag}</span>}
              </div>
              <div className="text-[14px] font-black text-white">
                {personal ? (
                  <>
                    <span className="text-[var(--a-gold)]">{personal.rank}e</span> sur {totalPlayers} · {scoreLabel(game, personal.score)}
                  </>
                ) : (
                  <span className="text-white/50 text-[12px]">Aucune partie enregistrée</span>
                )}
              </div>
            </div>
          </div>

          {onPlayGame && (
            <button
              type="button"
              onClick={() => onPlayGame(game)}
              className="rounded-xl bg-[var(--a-gold)] px-3.5 py-2 text-[12px] font-black text-[#1a1300] shadow-md hover:brightness-110 active:scale-95"
            >
              Jouer
            </button>
          )}
        </div>

        {/* Note profil discrète */}
        <p className="mt-2.5 text-center text-[10px] text-white/35">
          ℹ️ Ton profil est conservé sur cet appareil et peut être perdu si les données du navigateur sont effacées.
        </p>
      </div>
    </div>
  );
}

