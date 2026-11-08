import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Lock, Minus, Music, Play, Plus, RotateCcw, Share2, Swords, Trophy, Volume2, VolumeX, Plane } from "lucide-react";
import "./arena.css";
import GameView, { type Hud, type Splash } from "./GameView";
import EnvolGameView from "./EnvolGameView";
import ChampionsLeaderboard from "./ChampionsLeaderboard";
import type { ShotOutcome, FootSetup } from "./engine/foot";
import type { BasketSetup } from "./engine/basket";
import {
  BASKET_CHRONO, BASKET_DUEL, BASKET_STAGES, CHRONO_SECONDS, DIFFS, FOOT_DUEL, FOOT_STAGES, GAME_META, MODE_META,
  comboMult, starsFor, survivalStage, type BasketStage, type Difficulty, type FootStage, type GameId, type Mode
} from "./lib/config";
import { addDuel, addRecord, cleanName, loadSave, persist, progressOf, playerEvolution, DEFAULT_STATS, type DuelEntry, type SaveData, DEFAULT_SAVE } from "./lib/storage";
import { challengeKey, challengeUrl, decodeChallenge, type Challenge } from "./lib/challenge";
import { audio } from "./lib/audio";
import { randomSeed } from "./lib/rng";
import { CharacterPreview, ConfirmModal, GamePreview, Sheet, Stars, Toast, useReducedMotion } from "./ui";
import { LOGO_BL, LOGO_RDC } from "./engine/scene";
import { ROSTER, charFor, charById, hasJersey } from "./lib/roster";

const PLAYER_COLORS = ["#F4C400", "#72c3ec", "#f87171", "#a3e635"];

interface Player {
  female: boolean;
  name: string;
  number: number;
  color: string;
  score: number;
  made: number;
  shots: (boolean | null)[];
  streak: number;
  best: number;
  history: number[];
}

interface Session {
  game: GameId;
  mode: Mode;
  diff: Difficulty;
  stageIdx: number;
  seed: number;
  players: Player[];
  current: number;
  shot: number;
  global: number;
  chronoLeft: number;
  challenge: Challenge | null;
  /** Défi lancé par le joueur (aucun score à battre : il l'envoie ensuite). */
  creating?: boolean;
  over: boolean;
}

interface Result {
  title: string;
  subtitle: string;
  stars: number | null;
  passed: boolean;
  ranking: Player[];
  rank: number;
  canNext: boolean;
  shareable: boolean;
  won: boolean;
}

const newPlayer = (name: string, number: number, color: string, shots: number, female = false): Player => ({
  female,
  name, number, color, score: 0, made: 0, shots: Array(Math.min(shots, 10)).fill(null), streak: 0, best: 0, history: []
});

function stageFor(s: Session, p?: Player): FootStage | BasketStage {
  const pl = p || s.players[s.current];
  if (s.game === "foot") {
    if (s.mode === "carriere") return FOOT_STAGES[s.stageIdx];
    if (s.mode === "survie") return survivalStage(pl.made);
    if (s.mode === "defi" && s.challenge && s.challenge.st > 0) return FOOT_STAGES[s.challenge.st - 1];
    return FOOT_DUEL;
  }
  if (s.mode === "carriere") return BASKET_STAGES[s.stageIdx];
  if (s.mode === "chrono") return BASKET_CHRONO;
  if (s.mode === "defi" && s.challenge && s.challenge.st > 0) return BASKET_STAGES[s.challenge.st - 1];
  return BASKET_DUEL;
}

export default function ArenaApp({ initialGame = null }: { initialGame?: GameId | null }) {
  const reduced = useReducedMotion();
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<"home" | "play" | "results" | "envol">("home");
  const [sheet, setSheet] = useState<null | "setup" | "records" | "pause" | "profile">(null);
  const [showChampions, setShowChampions] = useState(false);
  const [playerSession, setPlayerSession] = useState<{ id: string; nickname: string; public_tag: string } | null>(null);
  /** Défi Envol 243 reçu par lien (?match=…) : score à battre. */
  const [envolOpponent, setEnvolOpponent] = useState<{ name: string; tag?: string; scoreToBeat: number } | null>(null);
  const [serverRankResult, setServerRankResult] = useState<{
    rankAllTime: number;
    rankWeek: number;
    bestScore: number;
    isNewRecord: boolean;
    challengeUrl?: string;
  } | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [setupGame, setSetupGame] = useState<GameId>("foot");
  const [setupMode, setSetupMode] = useState<Mode>("carriere");
  const [stagePick, setStagePick] = useState(0);
  const [names, setNames] = useState<string[]>(["", ""]);
  const [solo, setSolo] = useState({ name: "", number: 10, female: false });
  const [genders, setGenders] = useState<boolean[]>([false, false, false, false]);
  const [session, setSession] = useState<Session | null>(null);
  const [splash, setSplash] = useState<Splash | null>(null);
  const [handoff, setHandoff] = useState<number | null>(null);
  const [tutorial, setTutorial] = useState<GameId | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [hintOn, setHintOn] = useState(true);
  const [track, setTrack] = useState(audio.trackTitle);
  const splashKey = useRef(0);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  // chargement & session serveur persistante (cookie)
  useEffect(() => {
    const data = loadSave();
    setSave(data);
    setSolo({ name: data.name, number: data.number || 10, female: !!data.female });
    setNames([data.name || "", ""]);
    audio.setEnabled(data.sound);
    audio.onTrack = setTrack;
    const c = decodeChallenge(new URLSearchParams(window.location.search).get("defi"));
    if (c) setChallenge(c);
    setReady(true);

    // Initialisation session serveur anonyme persistante
    fetch(`/api/jeux/session${data.name ? `?name=${encodeURIComponent(data.name)}` : ""}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.player) {
          setPlayerSession(res.player);
          // Préremplir le pseudo si le navigateur a une session reconnue
          if (res.player.nickname && res.player.nickname !== "Léopard" && !data.name) {
            setSolo((prev) => ({ ...prev, name: res.player.nickname }));
            setNames((prev) => [res.player.nickname, ...prev.slice(1)]);
            update((d) => ({ ...d, name: res.player.nickname }));
          }
        }
      })
      .catch((e) => console.error("Session error:", e));

    // lien de défi Envol 243 : /jeux?match=<base64url>
    let envolDefi = false;
    try {
      const raw = new URLSearchParams(window.location.search).get("match");
      if (raw && raw.length < 600) {
        const m = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
        if (m && m.g === "envol" && Number.isFinite(Number(m.s))) {
          setEnvolOpponent({ name: cleanName(String(m.n || ""), "Un ami"), tag: m.t ? String(m.t).slice(0, 8) : undefined, scoreToBeat: Math.max(0, Math.round(Number(m.s))) });
          envolDefi = true;
        }
      }
    } catch {
      /* lien abîmé : on ignore */
    }

    // premier passage : on crée son joueur (sexe, nom, numéro) avant tout
    if (!data.name) setOnboarding(true);
    else if (initialGame === "envol" || envolDefi) setScreen("envol");
    else if (initialGame && !c) openSetup(initialGame, "carriere");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn: (d: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  function openSetup(game: GameId, mode: Mode) {
    setSetupGame(game);
    setSetupMode(mode);
    const prog = progressOf(loadSave(), game, loadSave().diff);
    const maxStage = (game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length) - 1;
    setStagePick(Math.max(0, Math.min(maxStage, prog.unlocked - 1)));
    setSheet("setup");
  }

  /* ---------------- Démarrage d'une partie ---------------- */

  function start() {
    audio.unlock();
    const mode = setupMode;
    const game = mode === "defi" && challenge ? challenge.g : setupGame;
    const diff = mode === "defi" && challenge ? challenge.d : save.diff;
    let players: Player[];
    const shotsFor = mode === "survie" || mode === "chrono" ? 10 : 5;
    if (mode === "duel") {
      const list = names.map((n, i) => cleanName(n, `Joueur ${i + 1}`));
      players = list.map((n, i) => newPlayer(n, [10, 7, 9, 11][i], PLAYER_COLORS[i], 5, genders[i]));
    } else {
      const n = cleanName(solo.name, "Léopard");
      players = [newPlayer(n, solo.number, PLAYER_COLORS[0], shotsFor, solo.female)];
      update((d) => ({ ...d, name: n, number: solo.number, female: solo.female }));
    }
    const s: Session = {
      game,
      mode,
      diff,
      stageIdx: stagePick,
      seed: mode === "defi" && challenge ? challenge.seed : randomSeed(),
      players,
      current: 0,
      shot: 0,
      global: 0,
      chronoLeft: CHRONO_SECONDS,
      challenge: mode === "defi" ? challenge : null,
      over: false
    };
    setSession(s);
    setSheet(null);
    setResult(null);
    setSplash(null);
    setHintOn(true);
    setScreen("play");
    if (!save.tutorial[game]) setTutorial(game);
    else if (mode === "duel") setHandoff(0);
  }

  /** Lance directement un défi : reçu (mêmes tirs que l'ami) ou nouveau (à envoyer ensuite). */
  function startDefi(game: GameId, received: Challenge | null, again?: { st: number; d: Difficulty; seed: number }) {
    audio.unlock();
    const data = loadSave();
    const n = cleanName(data.name || solo.name, "Léopard");
    const total = game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length;
    const c: Challenge = received || {
      g: game,
      st: Math.max(1, Math.min(total, progressOf(data, game, data.diff).unlocked)),
      d: data.diff,
      seed: randomSeed(),
      n,
      p: -1,
      r: 0,
      ...(again || {})
    };
    const s: Session = {
      game: c.g,
      mode: "defi",
      diff: c.d,
      stageIdx: Math.max(0, c.st - 1),
      seed: c.seed,
      players: [newPlayer(n, data.number || 10, PLAYER_COLORS[0], 5, !!data.female)],
      current: 0,
      shot: 0,
      global: 0,
      chronoLeft: CHRONO_SECONDS,
      challenge: c,
      creating: !received,
      over: false
    };
    setSession(s);
    setSheet(null);
    setResult(null);
    setSplash(null);
    setHintOn(true);
    setScreen("play");
    if (!data.tutorial[c.g]) setTutorial(c.g);
  }

  /* ---------------- Chrono global (basket) ---------------- */
  const playing = screen === "play" && !session?.over && !sheet && handoff === null && !tutorial && !confirmQuit;
  useEffect(() => {
    if (!playing || !session || session.mode !== "chrono" || session.over) return;
    const id = setInterval(() => {
      setSession((s) => {
        if (!s) return s;
        const left = Math.max(0, s.chronoLeft - 0.1);
        return { ...s, chronoLeft: left };
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, session?.mode, session?.over]);

  const busyRef = useRef(false);
  useEffect(() => {
    if (session?.mode === "chrono" && session.chronoLeft <= 0 && !session.over && !busyRef.current) {
      audio.buzzer();
      finish({ ...session, over: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.chronoLeft]);

  /* ---------------- Résultat d'un tir ---------------- */
  const onKick = useCallback(() => {
    busyRef.current = true;
    setHintOn(false);
  }, []);

  const onResult = useCallback((o: ShotOutcome) => {
    busyRef.current = false;
    const s = sessionRef.current;
    if (!s || s.over) return;
    const players = s.players.map((p) => ({ ...p, shots: [...p.shots], history: [...p.history] }));
    const p = players[s.current];
    const money = s.mode === "chrono" && s.global % 5 === 4;
    const streak = o.scored ? p.streak + 1 : 0;
    const mult = comboMult(streak);
    const pts = o.scored ? Math.round((o.base * mult * DIFFS[s.diff].scoreMult * (money ? 2 : 1)) / 5) * 5 : 0;
    p.score += pts;
    p.streak = streak;
    p.best = Math.max(p.best, streak);
    if (o.scored) p.made += 1;
    if (o.zone !== undefined && s.game === "foot" && !o.tags.includes("timeout")) p.history.push(o.zone);
    const idx = s.mode === "survie" || s.mode === "chrono" ? Math.min(p.shots.length - 1, s.shot) : s.shot;
    if (s.mode === "survie" || s.mode === "chrono") {
      if (s.shot >= p.shots.length) p.shots.push(o.scored);
      else p.shots[idx] = o.scored;
      if (p.shots.length > 10) p.shots = p.shots.slice(-10);
    } else p.shots[idx] = o.scored;
    if (o.scored && streak >= 2 && !reduced) audio.fanfare();
    splashKey.current += 1;
    setSplash({ key: splashKey.current, label: o.label, points: pts, detail: o.detail, tags: money ? [...o.tags, "money"] : o.tags, scored: o.scored });

    // Sauvegarde en temps réel de l'évolution du joueur dans le localStorage
    update((d) => {
      const prev = d.stats || DEFAULT_STATS;
      const isFoot = s.game === "foot";
      return {
        ...d,
        stats: {
          ...prev,
          totalShots: prev.totalShots + 1,
          totalGoals: prev.totalGoals + (isFoot && o.scored ? 1 : 0),
          totalBaskets: prev.totalBaskets + (!isFoot && o.scored ? 1 : 0),
          totalPoints: prev.totalPoints + pts,
          bestStreakFoot: isFoot ? Math.max(prev.bestStreakFoot, streak) : prev.bestStreakFoot,
          bestStreakBasket: !isFoot ? Math.max(prev.bestStreakBasket, streak) : prev.bestStreakBasket,
          lastPlayedDate: Date.now()
        }
      };
    });

    let next: Session = { ...s, players, shot: s.shot + 1, global: s.global + 1 };
    if (s.mode === "chrono" && o.tags.includes("swish")) next.chronoLeft = s.chronoLeft + 2;
    const stage = stageFor(s, p);
    // fin de série ?
    if (s.mode === "survie") {
      if (!o.scored) return finish({ ...next, over: true });
    } else if (s.mode === "chrono") {
      if (next.chronoLeft <= 0) return finish({ ...next, over: true });
    } else {
      const shots = stage.shots;
      const remaining = shots - next.shot;
      // carrière : impossible d'atteindre le palier → on continue quand même (pour les étoiles), sauf si tout est joué
      if (next.shot >= shots) {
        if (s.mode === "duel" && s.current < players.length - 1) {
          next = { ...next, current: s.current + 1, shot: 0 };
          setSession(next);
          setTimeout(() => setHandoff(next.current), 450);
          return;
        }
        // Conserver l'index du 5e tir pendant la transition vers les résultats.
        // Passer à `shot === shots` recréerait sinon un 6e shoot dans GameView.
        return finish({ ...next, shot: s.shot, over: true });
      }
      void remaining;
    }
    setSession(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  function finish(s: Session) {
    setSession(s);
    const players = s.players;
    const ranking = [...players].sort((a, b) => b.score - a.score);
    let stars: number | null = null;
    let passed = true;
    let canNext = false;
    let title = "";
    let subtitle = "";
    let won = false;
    const stage = stageFor(s, players[0]);
    let rank = -1;
    if (s.mode === "carriere") {
      stars = starsFor(players[0].made, stage.shots, stage.toPass);
      passed = stars > 0;
      won = passed;
      const totalStages = s.game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length;
      title = passed ? (s.stageIdx === totalStages - 1 ? "Grand Champion !" : "Palier réussi !") : "Pas cette fois";
      subtitle = passed
        ? `${players[0].made}/${stage.shots} · ${stage.name}`
        : `Il fallait ${stage.toPass} ${s.game === "foot" ? "buts" : "paniers"} sur ${stage.shots}. Tu en as ${players[0].made}.`;
      canNext = passed && s.stageIdx < totalStages - 1;
      const key = `${s.game}:${s.diff}`;
      update((d) => {
        const prog = progressOf(d, s.game, s.diff);
        const st = [...prog.stars];
        st[s.stageIdx] = Math.max(st[s.stageIdx] || 0, stars || 0);
        const unlocked = passed ? Math.max(prog.unlocked, Math.min(totalStages, s.stageIdx + 2)) : prog.unlocked;
        const prev = d.stats || DEFAULT_STATS;
        return {
          ...d,
          progress: { ...d.progress, [key]: { unlocked, stars: st } },
          stats: {
            ...prev,
            gamesPlayed: prev.gamesPlayed + 1,
            stagesCleared: prev.stagesCleared + (passed ? 1 : 0),
            lastPlayedDate: Date.now()
          }
        };
      });
    } else if (s.mode === "survie") {
      title = `${players[0].made} but${players[0].made > 1 ? "s" : ""} d'affilée`;
      subtitle = "Le gardien a fini par t'arrêter.";
      won = players[0].made >= 5;
    } else if (s.mode === "chrono") {
      title = `${players[0].made} panier${players[0].made > 1 ? "s" : ""}`;
      subtitle = "La sirène a retenti !";
      won = players[0].made >= 8;
    } else if (s.mode === "duel") {
      const top = ranking[0];
      const tie = ranking.length > 1 && ranking[1].score === top.score;
      title = tie ? "Égalité !" : `${top.name} gagne !`;
      subtitle = tie ? "Personne ne lâche rien : une revanche ?" : `${top.score} points · ${top.made}/5`;
      won = true;
    } else if (s.mode === "defi" && s.challenge) {
      const me = players[0];
      const c = s.challenge;
      let entry: DuelEntry;
      if (s.creating) {
        won = me.made >= stage.toPass;
        title = `${me.score} pts`;
        subtitle = `${me.made}/${stage.shots} · Envoie ton score : tes amis joueront exactement les mêmes tirs.`;
        entry = { key: challengeKey(c), friend: "", game: c.g, st: c.st, diff: c.d, seed: c.seed, me: me.score, them: null, outcome: "sent", round: 0, date: Date.now() };
      } else {
        won = me.score > c.p;
        const tie = me.score === c.p;
        title = won ? "Défi relevé !" : tie ? "Égalité parfaite" : "Défi perdu";
        subtitle = won
          ? `Tu bats ${c.n} de ${me.score - c.p} points. Envoie-lui la revanche !`
          : tie
            ? `Même score que ${c.n}. Départagez-vous !`
            : `${c.n} garde l'avantage de ${c.p - me.score} points. Retente ta chance ou renvoie-lui un défi.`;
        entry = { key: challengeKey(c), friend: c.n, game: c.g, st: c.st, diff: c.d, seed: c.seed, me: me.score, them: c.p, outcome: won ? "won" : tie ? "tie" : "lost", round: c.r || 0, date: Date.now() };
      }
      update((d) => addDuel(d, entry));
    }
    // classement local et validation serveur pour « Les champions du Bloc »
    if (s.mode !== "duel") {
      const me = players[0];
      const streakScore = Math.max(0, me.best);
      fetch("/api/jeux/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: s.game,
          score: streakScore,
          nickname: me.name,
          details: { made: me.made, points: me.score, shots: me.shots.length, mode: s.mode },
          nonce: `${s.game}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        })
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.result) {
            setServerRankResult({
              rankAllTime: res.result.rankAllTime,
              rankWeek: res.result.rankWeek,
              bestScore: res.result.bestScore,
              isNewRecord: res.result.isNewRecord,
              challengeUrl: res.challengeUrl
            });
          }
        })
        .catch((e) => console.error("Submit score error:", e));

      update((d) => {
        const r = addRecord(d, s.game, { name: me.name, score: me.score, mode: MODE_META[s.mode].label, diff: s.diff, date: Date.now() });
        rank = r.rank;
        return r.data;
      });
    } else {
      update((d) => {
        let data = d;
        for (const p of players) data = addRecord(data, s.game, { name: p.name, score: p.score, mode: "À plusieurs", diff: s.diff, date: Date.now() }).data;
        return data;
      });
    }
    if (won) audio.fanfare();
    setTimeout(() => {
      setResult({
        title, subtitle, stars, passed, ranking, rank, canNext, won,
        shareable: s.mode === "carriere" || s.mode === "defi" || s.mode === "duel" || s.mode === "survie" || s.mode === "chrono"
      });
      setScreen("results");
    }, 1700);
  }

  /* ---------------- Actions ---------------- */

  function replay(nextStage = false) {
    if (!session) return;
    setStagePick(nextStage ? Math.min((session.game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length) - 1, session.stageIdx + 1) : session.stageIdx);
    setSetupGame(session.game);
    setSetupMode(session.mode);
    setTimeout(() => {
      // relance immédiate avec les mêmes joueurs
      const s0 = session;
      const players = s0.players.map((p) => newPlayer(p.name, p.number, p.color, s0.mode === "survie" || s0.mode === "chrono" ? 10 : 5, p.female));
      setSession({
        ...s0,
        stageIdx: nextStage ? Math.min((s0.game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length) - 1, s0.stageIdx + 1) : s0.stageIdx,
        seed: s0.mode === "defi" ? s0.seed : randomSeed(),
        players,
        current: 0,
        shot: 0,
        global: 0,
        chronoLeft: CHRONO_SECONDS,
        over: false
      });
      setSplash(null);
      setResult(null);
      setScreen("play");
      if (s0.mode === "duel") setHandoff(0);
    }, 0);
  }

  /** Message + lien du défi à envoyer (nouveau défi, revanche ou score de partie). */
  function buildShare() {
    if (!session) return null;
    const me = session.mode === "duel" ? [...session.players].sort((a, b) => b.score - a.score)[0] : session.players[0];
    const prev = session.challenge;
    const total = session.game === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length;
    const st =
      session.mode === "carriere" ? session.stageIdx + 1 : prev ? prev.st : Math.max(1, Math.min(total, progressOf(save, session.game, session.diff).unlocked));
    // une partie hors carrière/défi devient un défi sur une série neuve au palier atteint
    const sameSeries = session.mode === "carriere" || session.mode === "defi";
    const c: Challenge = {
      g: session.game,
      st,
      d: session.diff,
      seed: sameSeries ? session.seed : randomSeed(),
      n: me.name,
      p: sameSeries ? me.score : 0,
      r: prev && !session.creating ? (prev.r || 0) + 1 : 0
    };
    const url = challengeUrl(c);
    const icon = session.game === "foot" ? "⚽" : "🏀";
    const game = GAME_META[session.game].title;
    let text: string;
    if (session.mode === "defi" && prev && !session.creating) {
      text =
        me.score > prev.p
          ? `${icon} ${prev.n}, j'ai battu ton score aux ${game} : ${me.score} contre ${prev.p} ! À toi de reprendre la main 🐆`
          : `${icon} Revanche ${prev.n} ! Tu m'as eu (${prev.p} contre ${me.score}). Mêmes tirs, à toi de défendre ton score 🐆`;
    } else if (!sameSeries) {
      text = `${icon} ${me.name} te défie aux ${game} de l'Arène des Léopards (palier ${st}). Mêmes tirs pour tout le monde : qui marque le plus ? 🐆`;
    } else {
      text = `${icon} ${me.name} te défie aux ${game} de l'Arène des Léopards : ${me.score} pts au palier ${st}. Mêmes tirs, mêmes conditions. Tu peux faire mieux ? 🐆`;
    }
    return { text, url };
  }

  function shareWhatsApp() {
    const sh = buildShare();
    if (!sh) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${sh.text}\n${sh.url}`)}`, "_blank", "noopener");
  }

  async function share() {
    const sh = buildShare();
    if (!sh) return;
    const { text, url } = sh;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Défi Bloc Léopards", text, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setToast("Lien du défi copié : envoie-le à tes amis");
    } catch {
      setToast("Copie impossible sur cet appareil");
    }
  }

  /** Rejoue un défi de l'historique (mêmes tirs). */
  function replayDuel(d: DuelEntry) {
    const c: Challenge = { g: d.game, st: d.st, d: d.diff, seed: d.seed, n: d.friend || "Toi", p: d.them ?? d.me, r: d.round };
    if (d.outcome === "sent") startDefi(d.game, null, { st: d.st, d: d.diff, seed: d.seed });
    else startDefi(d.game, c);
  }

  function toggleSound() {
    const on = !save.sound;
    audio.setEnabled(on);
    update((d) => ({ ...d, sound: on }));
  }
  function toggleMusic() {
    const on = !save.music;
    audio.unlock();
    audio.setMusic(on);
    update((d) => ({ ...d, music: on }));
  }

  /* ---------------- Données de jeu courantes ---------------- */

  const engineSetup = useMemo(() => {
    if (!session) return null;
    const p = session.players[session.current];
    const stage = stageFor(session, p);
    const base = {
      diff: DIFFS[session.diff],
      seed: session.seed,
      shot: session.mode === "chrono" ? session.global : session.shot,
      name: p.name,
      number: p.number,
      female: p.female,
      character: charFor(save.character, p.female),
      reduced
    };
    if (session.game === "foot") return { ...base, stage: stage as FootStage, history: p.history } as FootSetup;
    return {
      ...base,
      stage: stage as BasketStage,
      fire: p.streak >= 3,
      money: session.mode === "chrono" && session.global % 5 === 4,
      fast: session.mode === "chrono"
    } as BasketSetup;
  }, [session?.seed, session?.current, session?.shot, session?.global, session?.game, session?.mode, session?.stageIdx, reduced]);

  const clockMax = useMemo(() => {
    if (!session || session.mode === "chrono") return 0;
    const stage = stageFor(session);
    return Math.round(stage.clock * DIFFS[session.diff].clock);
  }, [session?.mode, session?.game, session?.stageIdx, session?.diff, session?.shot, session?.current]);

  const hud: Hud | null = useMemo(() => {
    if (!session) return null;
    const p = session.players[session.current];
    const stage = stageFor(session, p);
    const title = session.mode === "carriere" ? `Palier ${session.stageIdx + 1} · ${stage.name}` : session.mode === "survie" ? `Mort subite · ${stage.pitch}` : stage.name;
    const sub =
      session.mode === "chrono"
        ? `${p.made} paniers`
        : session.mode === "survie"
          ? `${p.made} but${p.made > 1 ? "s" : ""}`
          : `Tir ${Math.min(session.shot + 1, stage.shots)}/${stage.shots}${stage.toPass ? ` · objectif ${stage.toPass}` : ""}`;
    return {
      score: p.score,
      title,
      sub,
      shots: p.shots,
      streak: p.streak,
      mult: comboMult(p.streak + 1) > 1 ? comboMult(p.streak + 1) : 1,
      player: session.mode === "duel" ? { name: p.name, color: p.color } : undefined,
      chrono: session.mode === "chrono" ? session.chronoLeft : undefined,
      target: session.mode === "defi" && session.challenge ? { name: session.challenge.n, score: session.challenge.p } : undefined
    };
  }, [session]);

  const hint = useMemo(() => {
    if (!session || !hintOn) return null;
    if (session.game === "foot") {
      const st = stageFor(session) as FootStage;
      if (st.wall) return "Coup franc : tire moins fort pour lober le mur, ou courbe ton geste";
      return "Glisse le ballon vers la cage · courbe le geste pour enrouler";
    }
    const st = stageFor(session) as BasketStage;
    if (st.defender) return "Tire avant que le défenseur ne saute !";
    return "Maintiens appuyé, relâche quand la jauge est dans le vert";
  }, [session?.game, session?.mode, session?.stageIdx, hintOn]);

  if (!ready) return <div className="arena fixed inset-0" />;

  const prog = (g: GameId) => progressOf(save, g, save.diff);

  /* ================================================================ */
  return (
    <div className="arena fixed inset-0 overflow-hidden">
      {screen === "home" && (
        <Home
          save={save}
          playerTag={playerSession?.public_tag}
          reduced={reduced}
          challenge={challenge}
          onPick={(g) => {
            if (g === "envol") {
              window.location.href = "/jeux/envol243";
            } else {
              openSetup(g, "carriere");
            }
          }}
          onOpenChampions={() => setShowChampions(true)}
          onDuel={() => openSetup("foot", "duel")}
          onChallenge={() => challenge && startDefi(challenge.g, challenge)}
          onNewDefi={(g) => (save.name ? startDefi(g, null) : setOnboarding(true))}
          onDuelReplay={replayDuel}
          onRecords={() => setSheet("records")}
          onSound={toggleSound}
          onProfile={() => setSheet("profile")}
        />
      )}

      {screen !== "home" && screen !== "envol" && session && engineSetup && hud && (
        <GameView
          game={session.game}
          setupKey={`${session.seed}-${session.current}-${session.shot}-${session.global}-${session.stageIdx}-${session.mode}`}
          setup={engineSetup}
          paused={!playing || screen !== "play"}
          clockMax={clockMax}
          hud={hud}
          hint={hint}
          splash={splash}
          onResult={onResult}
          onKick={onKick}
          onPause={() => setSheet("pause")}
          onInteract={() => audio.unlock()}
          soundOn={save.sound}
          onToggleSound={toggleSound}
          needsFemale={session.players.some((p) => p.female)}
        />
      )}

      {screen === "envol" && (
        <EnvolGameView
          playerName={save.name || "Léopard"}
          playerTag={playerSession?.public_tag || "243"}
          opponent={envolOpponent}
          reduced={reduced}
          onExit={() => setScreen("home")}
          onScoreSubmitted={() => {
            fetch("/api/jeux/session")
              .then((r) => r.json())
              .then((res) => {
                if (res.success && res.player) setPlayerSession(res.player);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* Passe le téléphone */}
      {handoff !== null && session && screen === "play" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(2,6,18,0.86)] px-6 text-center backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
          <div className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--a-muted)]">Passe le téléphone à</div>
          <h2 id="handoff-title" className="display mt-2 text-[64px]" style={{ color: session.players[handoff].color }}>
            {session.players[handoff].name}
          </h2>
          <p className="mt-2 max-w-xs text-[15px] text-white/80">
            5 tirs, même gardien, mêmes conditions pour tout le monde.
            {handoff > 0 && ` Score à battre : ${Math.max(...session.players.slice(0, handoff).map((p) => p.score))} pts.`}
          </p>
          <button className="a-btn a-btn-primary mt-8 w-full max-w-xs text-[17px]" onClick={() => setHandoff(null)} autoFocus>
            <Play size={18} fill="currentColor" /> C'est parti
          </button>
        </div>
      )}

      {/* Tutoriel court */}
      {tutorial && (
        <Tutorial
          game={tutorial}
          onDone={() => {
            update((d) => ({ ...d, tutorial: { ...d.tutorial, [tutorial]: true } }));
            setTutorial(null);
            if (session?.mode === "duel") setHandoff(0);
          }}
        />
      )}

      {/* Résultats */}
      {screen === "results" && result && session && (
        <Results
          result={result}
          session={session}
          reduced={reduced}
          serverRank={serverRankResult}
          onOpenChampions={() => setShowChampions(true)}
          onReplay={() => replay(false)}
          onNext={() => replay(true)}
          onShare={share}
          onWhatsApp={shareWhatsApp}
          onHome={() => {
            setScreen("home");
            setSession(null);
          }}
        />
      )}

      {/* Feuilles */}
      {sheet === "setup" && (
        <SetupSheet
          save={save}
          game={setupGame}
          mode={setupMode}
          stage={stagePick}
          names={names}
          solo={solo}
          character={charFor(save.character, solo.female)}
          reduced={reduced}
          challenge={challenge}
          prog={prog}
          onGame={(g) => {
            setSetupGame(g);
            if (setupMode === "survie" && g === "basket") setSetupMode("chrono");
            if (setupMode === "chrono" && g === "foot") setSetupMode("survie");
            setStagePick(Math.max(0, progressOf(save, g, save.diff).unlocked - 1));
          }}
          onCharacter={(cid) => {
            update((d) => ({ ...d, character: cid }));
          }}
          onMode={setSetupMode}
          onStage={setStagePick}
          onDiff={(d) => {
            update((s) => ({ ...s, diff: d }));
            setStagePick(Math.max(0, progressOf(save, setupGame, d).unlocked - 1));
          }}
          onNames={setNames}
          genders={genders}
          onGenders={setGenders}
          onSolo={setSolo}
          onClose={() => setSheet(null)}
          onStart={() => {
            if (setupMode === "defi" && !challenge) {
              startDefi(setupGame, null);
            } else {
              start();
            }
          }}
          onStartDefi={(g) => startDefi(g, null)}
        />
      )}
      {sheet === "records" && <RecordsSheet save={save} onClose={() => setSheet(null)} />}
      {(onboarding || sheet === "profile") && (
        <ProfileSheet
          first={onboarding}
          initial={{ name: save.name, number: save.number || 10, female: !!save.female, character: charFor(save.character, !!save.female) }}
          reduced={reduced}
          onClose={() => {
            if (!onboarding) setSheet(null);
          }}
          onSave={(pr) => {
            const n = cleanName(pr.name, "Léopard");
            update((d) => ({ ...d, name: n, number: pr.number, female: pr.female, character: pr.character }));
            setSolo({ name: n, number: pr.number, female: pr.female });
            setNames((prev) => [n, ...prev.slice(1)]);
            setGenders((prev) => [pr.female, ...prev.slice(1)]);
            // Synchronise le pseudo côté serveur pour la session persistante
            fetch("/api/jeux/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nickname: n })
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.success && res.player) {
                  setPlayerSession(res.player);
                }
              })
              .catch((e) => console.error("Update pseudo error:", e));
            setSheet(null);
            if (onboarding) {
              setOnboarding(false);
              if (initialGame === "envol" || envolOpponent) {
                setScreen("envol");
              } else if (initialGame) {
                openSetup(initialGame, "carriere");
              }
            }
          }}
        />
      )}
      {sheet === "pause" && session && (
        <Sheet title="Pause" onClose={() => setSheet(null)}>
          <div className="grid gap-2.5 pb-2">
            <button className="a-btn a-btn-primary w-full text-[16px]" onClick={() => setSheet(null)} autoFocus>
              <Play size={18} fill="currentColor" /> Reprendre
            </button>
            <button
              className="a-btn a-btn-secondary w-full"
              onClick={() => {
                setSheet(null);
                replay(false);
              }}
            >
              <RotateCcw size={18} /> Recommencer la série
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="a-btn a-btn-secondary" onClick={toggleSound} aria-pressed={save.sound}>
                {save.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} Son {save.sound ? "activé" : "coupé"}
              </button>
              <button className="a-btn a-btn-secondary" onClick={toggleMusic} aria-pressed={save.music}>
                <Music size={18} /> Musique {save.music ? "on" : "off"}
              </button>
            </div>
            {save.music && (
              <button className="a-btn a-btn-ghost w-full text-[13px]" onClick={() => audio.nextTrack()}>
                En cours : {track} · morceau suivant
              </button>
            )}
            <button className="a-btn a-btn-ghost w-full text-red-300" onClick={() => setConfirmQuit(true)}>
              Quitter la partie
            </button>
          </div>
        </Sheet>
      )}
      {confirmQuit && (
        <ConfirmModal
          title="Quitter la partie ?"
          text="La série en cours sera perdue et ne comptera pas au classement."
          confirm="Quitter"
          danger
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => {
            setConfirmQuit(false);
            setSheet(null);
            setSession(null);
            setHandoff(null);
            setScreen("home");
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}

      {showChampions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
          <ChampionsLeaderboard
            initialGame={setupGame || "foot"}
            currentPlayerId={playerSession?.id}
            onClose={() => setShowChampions(false)}
            onPlayGame={(g) => {
              setShowChampions(false);
              if (g === "envol") {
                window.location.href = "/jeux/envol243";
              } else {
                openSetup(g, "carriere");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Accueil : les deux jeux côte à côte                                */
/* ================================================================== */

function Home(props: {
  save: SaveData;
  playerTag?: string;
  reduced: boolean;
  challenge: Challenge | null;
  onPick: (g: GameId) => void;
  onOpenChampions: () => void;
  onDuel: () => void;
  onChallenge: () => void;
  onNewDefi: (g: GameId) => void;
  onDuelReplay: (d: DuelEntry) => void;
  onRecords: () => void;
  onSound: () => void;
  onProfile: () => void;
}) {
  const { save } = props;
  const best = (g: GameId) => (save.records[g] || [])[0]?.score ?? 0;
  const prog = (g: GameId) => progressOf(save, g, save.diff);
  const evo = playerEvolution(save);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="safe-top flex items-center justify-between px-4 pb-2">
        <a href="/" className="a-btn a-btn-ghost -ml-3 min-h-[44px] px-3 text-[14px]" aria-label="Retour au site Bloc Léopards">
          <ArrowLeft size={18} /> Site
        </a>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="a-btn a-btn-secondary min-h-[44px] px-3 text-[13px] text-[var(--a-gold)]"
            onClick={props.onOpenChampions}
            aria-label="Classement Les champions du Bloc"
          >
            <Trophy size={16} />
            <span className="text-[12px] font-bold">Champions</span>
          </button>
          <button className="a-btn a-btn-secondary min-h-[44px] max-w-[170px] sm:max-w-[220px] px-3 text-[13px]" onClick={props.onProfile} aria-label="Modifier ton joueur">
            <span className="truncate">
              {save.name
                ? `${save.name}${props.playerTag ? ` · #${props.playerTag}` : ""}`
                : "Crée ton joueur"}
            </span>
            <Pencil size={14} />
          </button>
          <button className="a-icon-btn" onClick={props.onSound} aria-label={save.sound ? "Couper le son" : "Activer le son"} aria-pressed={save.sound}>
            {save.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </header>

      {/* Les deux marques mises en avant */}
      <div className="flex items-center justify-center gap-4 px-4">
        <img src={LOGO_BL} alt="Bloc Léopards" className="h-[92px] w-auto drop-shadow-[0_10px_24px_rgba(244,196,0,0.25)] sm:h-[120px]" width={97} height={92} />
        <span className="h-14 w-px bg-white/20" aria-hidden="true" />
        <img src={LOGO_RDC} alt="R.D. Congo, Cœur de l'Afrique" className="h-[38px] w-auto sm:h-[48px]" width={136} height={38} />
      </div>
      <h1 className="display mt-3 text-center text-[42px] sm:text-[56px]">
        L'Arène des <span className="text-[var(--a-gold)]">Léopards</span>
      </h1>
      <p className="mx-auto mt-1 max-w-sm px-6 text-center text-[14px] text-[var(--a-muted)]">Choisis ton terrain. Un geste du pouce suffit.</p>

      {/* Évolution & statut de carrière du joueur */}
      <div className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-2 px-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(244,196,0,0.15)] px-3 py-1 text-[13px] font-black text-[var(--a-gold)] shadow-[inset_0_0_0_1px_rgba(244,196,0,0.3)]">
          ⭐ {evo.rankTitle}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] font-bold text-white/90">
          ★ {evo.totalStars} étoiles
        </span>
        {evo.goals > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] font-bold text-white/90">
            ⚽ {evo.goals} buts
          </span>
        )}
        {evo.baskets > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] font-bold text-white/90">
            🏀 {evo.baskets} paniers
          </span>
        )}
      </div>

      <main className="mx-auto mt-4 w-full max-w-3xl flex-1 px-4">
        {props.challenge && (
          <section className="a-defi-hero mb-4" aria-labelledby="defi-recu">
            <span className="a-defi-tag">
              <Swords size={14} /> {props.challenge.r ? `Revanche n°${props.challenge.r}` : "Défi reçu"}
            </span>
            <h2 id="defi-recu" className="display mt-2 text-[34px] leading-none sm:text-[44px]">
              {props.challenge.n} te défie
            </h2>
            <p className="mt-1.5 text-[14px] text-white/80">
              {GAME_META[props.challenge.g].title}
              {props.challenge.st > 0 ? ` · palier ${props.challenge.st}` : ""} · {DIFFS[props.challenge.d].label} · mêmes tirs que ton ami
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span className="display text-[56px] leading-none text-[var(--a-gold)]">{Math.max(0, props.challenge.p)}</span>
              <span className="pb-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">points à battre</span>
            </div>
            <button className="a-btn a-btn-primary mt-4 w-full text-[17px]" onClick={props.onChallenge}>
              <Play size={16} fill="currentColor" /> Relever le défi
            </button>
          </section>
        )}

        {/* 1. Sélection immédiate des 3 jeux officiels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {(["foot", "basket", "envol"] as GameId[]).map((g) => {
            const isEnvol = g === "envol";
            const totalStages = isEnvol ? 3 : g === "foot" ? FOOT_STAGES.length : BASKET_STAGES.length;
            const p = prog(g);
            return (
              <button key={g} className="a-game-card group" onClick={() => props.onPick(g)} aria-label={`Jouer : ${GAME_META[g].title}`}>
                <div className="aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden">
                  <GamePreview game={g} reduced={props.reduced} />
                </div>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--a-gold)]">
                      {GAME_META[g].short}
                    </span>
                    <span className="rounded-full bg-[rgba(244,196,0,0.18)] px-2 py-0.5 text-[10px] font-black text-[var(--a-gold)]">
                      {isEnvol ? "Crash & Mises · 3D" : `${totalStages} Paliers`}
                    </span>
                  </div>
                  <span className="display mt-0.5 text-[22px] sm:text-[26px] transition-colors group-hover:text-[var(--a-gold)]">
                    {GAME_META[g].title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--a-muted)]">
                    {isEnvol ? (
                      <span className="font-bold text-emerald-400">Argent fictif · 10 000 CDF</span>
                    ) : (
                      <>
                        <span className="font-bold text-white/90">Palier {p.unlocked}/{totalStages}</span>
                        <span aria-label="Étoiles gagnées" className="text-[var(--a-gold)]">★ {p.stars.reduce((a, b) => a + b, 0)}/{totalStages * 3}</span>
                      </>
                    )}
                  </span>
                  {best(g) > 0 && (
                    <span className="mt-0.5 text-[12px] font-medium text-white/70">
                      Record : {best(g).toLocaleString("fr-FR")} {isEnvol ? "CDF" : "série"}
                    </span>
                  )}
                  <span className="h-3" aria-hidden="true" />
                  <span className="a-btn a-btn-primary mt-auto min-h-[44px] w-full text-[14px] shadow-[0_4px_16px_rgba(244,196,0,0.25)]">
                    <Play size={16} fill="currentColor" /> Jouer
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Derniers défis disputés */}
        {(save.duels || []).length > 0 && (
          <section className="mt-5 rounded-2xl bg-[rgba(255,255,255,0.04)] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <h3 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Tes derniers défis entre amis</h3>
            <ul className="grid grid-cols-1 gap-1.5">
              {(save.duels || []).slice(0, 4).map((d) => (
                <li key={d.key + d.friend} className="min-w-0">
                  <button className="a-duel-row" onClick={() => props.onDuelReplay(d)}>
                    <span className={`a-duel-badge is-${d.outcome}`}>
                      {d.outcome === "won" ? "Gagné" : d.outcome === "lost" ? "Perdu" : d.outcome === "tie" ? "Égalité" : "Envoyé"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left text-[14px] font-bold">
                      {d.friend ? `contre ${d.friend}` : "Ton défi"} · {GAME_META[d.game].short}
                    </span>
                    <span className="text-[13px] font-extrabold tabular-nums">
                      {d.me}
                      {d.them !== null ? ` – ${d.them}` : " pts"}
                    </span>
                    <span className="text-[12px] font-bold text-[var(--a-gold)]">{d.outcome === "lost" || d.outcome === "tie" ? "Revanche" : "Rejouer"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3">
          <button className="a-btn a-btn-secondary w-full" onClick={props.onRecords}>
            <Trophy size={18} /> Records & Évolution
          </button>
        </div>

        <div className="h-6" aria-hidden="true" />
      </main>
      <footer className="safe-bottom px-4 text-center text-[11px] text-white/40">© {new Date().getFullYear()} Bloc Léopards</footer>
    </div>
  );
}

/* ================================================================== */
/* Configuration de la partie (un seul formulaire)                    */
/* ================================================================== */

function SetupSheet(props: {
  save: SaveData;
  game: GameId;
  mode: Mode;
  stage: number;
  names: string[];
  solo: { name: string; number: number; female: boolean };
  character: string;
  reduced: boolean;
  challenge: Challenge | null;
  prog: (g: GameId) => { unlocked: number; stars: number[] };
  onGame: (g: GameId) => void;
  onCharacter: (cid: string) => void;
  onMode: (m: Mode) => void;
  onStage: (i: number) => void;
  onDiff: (d: Difficulty) => void;
  onNames: (n: string[]) => void;
  genders: boolean[];
  onGenders: (g: boolean[]) => void;
  onSolo: (s: { name: string; number: number; female: boolean }) => void;
  onClose: () => void;
  onStart: () => void;
  onStartDefi: (g: GameId) => void;
}) {
  const { game, mode, save } = props;
  const isDefi = mode === "defi" && props.challenge;
  const g = isDefi ? props.challenge!.g : game;
  const prog = props.prog(g);
  const stages = g === "foot" ? FOOT_STAGES : BASKET_STAGES;
  const soloOk = props.solo.name.trim().length > 0;
  const duelOk = props.names.every((n) => n.trim().length > 0);
  const [charReady, setCharReady] = useState(true);
  const canStart = (mode === "duel" ? duelOk : soloOk) && charReady;

  return (
    <Sheet
      title={isDefi ? "Relever le défi" : GAME_META[g].title}
      onClose={props.onClose}
      footer={
        <button type="submit" form="setup-form" className="a-btn a-btn-primary w-full text-[17px]" disabled={!canStart}>
          {!charReady ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Chargement du joueur 3D...
            </span>
          ) : (
            <>
              <Play size={18} fill="currentColor" /> {mode === "defi" ? "Lancer le Défi" : mode === "duel" ? "Lancer le Duel" : "Entrer sur le Terrain"}
            </>
          )}
        </button>
      }
    >
      <form
        id="setup-form"
        className="grid min-w-0 grid-cols-1 gap-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) props.onStart();
        }}
      >
        {/* ÉTAPE 1 : Choix du jeu */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.04)] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-black uppercase tracking-wider text-[var(--a-gold)]">
              1. Choix du Jeu
            </span>
            {!isDefi ? (
              <div className="a-seg !mb-0 !w-auto" role="radiogroup" aria-label="Jeu">
                {(["foot", "basket"] as GameId[]).map((x) => (
                  <button type="button" key={x} role="radio" aria-checked={game === x} onClick={() => props.onGame(x)}>
                    {GAME_META[x].short}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[12px] font-bold text-white/80">{GAME_META[g].short}</span>
            )}
          </div>
        </div>

        {/* ÉTAPE 2 : Ton personnage */}
        <fieldset className="min-w-0 rounded-2xl bg-[rgba(255,255,255,0.04)] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
          <legend className="px-1 text-[12px] font-black uppercase tracking-wider text-[var(--a-gold)]">
            2. Ton Personnage Léopard
          </legend>

          <div className="mx-auto h-[180px] w-full max-w-[220px]">
            <CharacterPreview
              female={props.solo.female}
              character={props.character}
              name={props.solo.name}
              number={props.solo.number}
              reduced={props.reduced}
              onLoadedChange={setCharReady}
            />
          </div>

          <div className="a-seg mt-2" role="radiogroup" aria-label="Genre">
            {[false, true].map((f) => (
              <button
                type="button"
                key={String(f)}
                role="radio"
                aria-checked={props.solo.female === f}
                onClick={() => {
                  props.onSolo({ ...props.solo, female: f });
                  props.onCharacter(charFor(null, f));
                }}
              >
                {f ? "Joueuse" : "Joueur"}
              </button>
            ))}
          </div>

          <div className="mt-2.5">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/60">
              {props.solo.female ? "Héroïnes Léopards" : "Figures du Onze des Léopards"}
            </span>
            <div className="a-chars flex flex-wrap gap-1.5" role="radiogroup">
              {ROSTER.filter((c) => c.female === props.solo.female).map((c) => {
                const active = props.character === c.id;
                const isJersey = hasJersey(c);
                return (
                  <button
                    type="button"
                    key={c.id}
                    role="radio"
                    aria-checked={active}
                    className={`group inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold transition-all duration-150 active:scale-95 ${
                      active
                        ? "bg-[var(--a-gold)] text-[#1a1300] shadow-[0_0_12px_rgba(244,196,0,0.35)]"
                        : "bg-white/5 text-white/85 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    }`}
                    onClick={() => {
                      props.onCharacter(c.id);
                      if (c.label && !c.label.startsWith("Léopard")) {
                        props.onSolo({ ...props.solo, name: c.label.split(" ")[0].toUpperCase() });
                      }
                    }}
                  >
                    <span>{c.label}</span>
                    {c.roleHint && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          active
                            ? "bg-black/20 text-[#1a1300]"
                            : isJersey
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {c.roleHint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {hasJersey(props.character) ? (
            <div className="mt-3 grid grid-cols-[1fr_88px] gap-2">
              <label>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">Nom sur le maillot</span>
                <input
                  className="a-input !h-10 text-[14px]"
                  value={props.solo.name}
                  maxLength={14}
                  autoComplete="nickname"
                  placeholder="Ton nom"
                  onChange={(e) => props.onSolo({ ...props.solo, name: e.target.value })}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/60">Numéro</span>
                <input
                  className="a-input !h-10 text-center text-[14px]"
                  inputMode="numeric"
                  value={props.solo.number}
                  onChange={(e) => props.onSolo({ ...props.solo, number: Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                  aria-label="Numéro de maillot"
                />
              </label>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Nom du joueur</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Tenue civile · Pas de numéro
                </span>
              </div>
              <input
                className="a-input !h-10 text-[14px]"
                value={props.solo.name}
                maxLength={14}
                autoComplete="nickname"
                placeholder="Ton pseudo ou nom"
                onChange={(e) => props.onSolo({ ...props.solo, name: e.target.value })}
                required
              />
            </div>
          )}
        </fieldset>

        {/* ÉTAPE 3 : Choix du mode (Défi ou Pas ?) */}
        {isDefi ? (
          <div className="a-choice" aria-live="polite">
            <div className="text-[15px] font-extrabold text-[var(--a-gold)]">
              {props.challenge!.n} a marqué {props.challenge!.p} points
            </div>
            <div className="mt-1 text-[13px] text-[var(--a-muted)]">
              Mêmes conditions que ton ami · difficulté {DIFFS[props.challenge!.d].label}
            </div>
          </div>
        ) : (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[12px] font-black uppercase tracking-wider text-[var(--a-gold)]">
              3. Choisis ton mode : Défi ou Pas ?
            </legend>
            <div className="grid gap-2" role="radiogroup">
              {/* Option 1 : Carrière (Normal / Solo) */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "carriere"}
                className="a-choice flex items-center justify-between text-left"
                onClick={() => props.onMode("carriere")}
              >
                <div>
                  <span className="block text-[15px] font-extrabold text-white">🏆 Carrière Solo (15 Niveaux)</span>
                  <span className="block text-[12px] text-[var(--a-muted)]">Progression par paliers de difficulté croissante</span>
                </div>
                <span className="text-[12px] font-bold text-[var(--a-gold)]">
                  Palier {prog.unlocked}/{stages.length}
                </span>
              </button>

              {/* Option 2 : Défi Amis WhatsApp */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "defi"}
                className="a-choice flex items-center justify-between text-left"
                onClick={() => props.onMode("defi")}
              >
                <div>
                  <span className="block text-[15px] font-extrabold text-[var(--a-gold)]">⚔️ Défi Amis (WhatsApp)</span>
                  <span className="block text-[12px] text-[var(--a-muted)]">5 tirs identiques : ton score génère un lien WhatsApp à battre</span>
                </div>
                <span className="rounded-full bg-[rgba(244,196,0,0.2)] px-2.5 py-0.5 text-[11px] font-black text-[var(--a-gold)]">
                  DÉFI
                </span>
              </button>

              {/* Option 3 : Duel sur le même écran */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "duel"}
                className="a-choice flex items-center justify-between text-left"
                onClick={() => props.onMode("duel")}
              >
                <div>
                  <span className="block text-[15px] font-extrabold text-white">👥 Duel 2 Joueurs (Même écran)</span>
                  <span className="block text-[12px] text-[var(--a-muted)]">Passez-vous le téléphone chacun votre tour</span>
                </div>
              </button>
            </div>
          </fieldset>
        )}

        {/* Détails du mode Carrière : Paliers & Difficulté */}
        {mode === "carriere" && (
          <>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Palier débloqué</legend>
              <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1" role="radiogroup">
                {stages.map((st, i) => {
                  const locked = i + 1 > prog.unlocked;
                  return (
                    <button
                      type="button"
                      key={st.id}
                      role="radio"
                      aria-checked={props.stage === i}
                      aria-disabled={locked}
                      disabled={locked}
                      onClick={() => props.onStage(i)}
                      className="a-choice !w-[148px] shrink-0 snap-start disabled:opacity-45"
                    >
                      <span className="flex items-center justify-between">
                        <span className="display text-[26px] text-[var(--a-gold)]">{i + 1}</span>
                        {locked ? <Lock size={16} className="text-white/50" /> : <Stars n={prog.stars[i] || 0} size={13} />}
                      </span>
                      <span className="block text-[14px] font-extrabold">{st.name}</span>
                      <span className="block text-[12px] leading-snug text-[var(--a-muted)]">{st.pitch}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Difficulté</legend>
              <div className="a-seg" role="radiogroup" aria-label="Difficulté">
                {(["facile", "pro", "legende"] as Difficulty[]).map((d) => (
                  <button type="button" key={d} role="radio" aria-checked={save.diff === d} onClick={() => props.onDiff(d)}>
                    {DIFFS[d].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-[var(--a-muted)]">
                {DIFFS[save.diff].hint} · points ×{DIFFS[save.diff].scoreMult}
              </p>
            </fieldset>
          </>
        )}

        {/* Détails du mode Défi */}
        {mode === "defi" && !isDefi && (
          <div className="rounded-2xl bg-[rgba(244,196,0,0.1)] p-3 text-[13px] text-white/90 shadow-[inset_0_0_0_1px_rgba(244,196,0,0.25)]">
            Tu vas tirer <strong className="text-[var(--a-gold)]">5 fois</strong>. À la fin, tu pourras envoyer ton score sur WhatsApp avec le lien pour que tes amis relèvent exactement le même défi !
          </div>
        )}

        {/* Détails du mode Duel */}
        {mode === "duel" && (
          <fieldset className="min-w-0">
            <legend className="mb-2 flex w-full items-center justify-between text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">
              <span>Joueurs</span>
              <span className="flex items-center gap-1 normal-case tracking-normal">
                <button
                  type="button"
                  className="a-icon-btn h-9 w-9"
                  aria-label="Retirer un joueur"
                  disabled={props.names.length <= 2}
                  onClick={() => props.onNames(props.names.slice(0, -1))}
                >
                  <Minus size={16} />
                </button>
                <span className="w-6 text-center text-[15px] font-extrabold text-white">{props.names.length}</span>
                <button
                  type="button"
                  className="a-icon-btn h-9 w-9"
                  aria-label="Ajouter un joueur"
                  disabled={props.names.length >= 4}
                  onClick={() => props.onNames([...props.names, ""])}
                >
                  <Plus size={16} />
                </button>
              </span>
            </legend>
            <div className="grid gap-2">
              {props.names.map((n, i) => (
                <label key={i} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} aria-hidden="true" />
                  <span className="sr-only">Nom du joueur {i + 1}</span>
                  <input
                    className="a-input"
                    value={n}
                    maxLength={14}
                    autoComplete="off"
                    placeholder={`Nom du joueur ${i + 1}`}
                    onChange={(e) => {
                      const next = [...props.names];
                      next[i] = e.target.value;
                      props.onNames(next);
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="a-btn a-btn-secondary min-h-[48px] shrink-0 px-3 text-[13px]"
                    aria-pressed={props.genders[i]}
                    onClick={() => {
                      const g = [...props.genders];
                      g[i] = !g[i];
                      props.onGenders(g);
                    }}
                  >
                    {props.genders[i] ? "Joueuse" : "Joueur"}
                  </button>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-[var(--a-muted)]">Chacun tire 5 fois avec les mêmes conditions, puis passe le téléphone.</p>
          </fieldset>
        )}
      </form>
    </Sheet>
  );
}

/* ================================================================== */

function Tutorial({ game, onDone }: { game: GameId; onDone: () => void }) {
  const steps =
    game === "foot"
      ? [
          ["Glisse", "Pose le doigt sur le ballon et glisse vers le coin visé."],
          ["Dose", "Geste rapide = frappe puissante. Trop vite, ça part au-dessus."],
          ["Enroule", "Courbe ton geste pour enrouler. Le gardien apprend tes habitudes : varie !"]
        ]
      : [
          ["Maintiens", "Garde le doigt appuyé : ton joueur arme son tir et la jauge monte toute seule."],
          ["Relâche au bon moment", "Lâche quand la jauge est dans le vert. Trop tôt : trop court. Trop tard : trop long."],
          ["Vise droit", "Glisser le doigt sur le côté dévie le tir. De loin, la jauge monte plus vite."]
        ];
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,18,0.78)] backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tuto-title">
      <div className="w-full max-w-md rounded-t-[26px] bg-[#0d1a3d] p-5 safe-bottom sm:rounded-[26px]">
        <h2 id="tuto-title" className="display text-[34px]">
          Comment jouer
        </h2>
        <ol className="mt-3 grid gap-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--a-gold)] text-[24px] text-[#1a1300]">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-extrabold">{t}</span>
                <span className="block text-[14px] text-[var(--a-muted)]">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <button className="a-btn a-btn-primary mt-5 w-full text-[17px]" onClick={onDone} autoFocus>
          J'ai compris
        </button>
      </div>
    </div>
  );
}

function Results(props: {
  result: Result;
  session: Session;
  reduced: boolean;
  serverRank?: { rankAllTime: number; rankWeek: number; bestScore: number; isNewRecord: boolean; challengeUrl?: string } | null;
  onOpenChampions?: () => void;
  onReplay: () => void;
  onNext: () => void;
  onShare: () => void;
  onWhatsApp: () => void;
  onHome: () => void;
}) {
  const { result, session } = props;
  const me = session.players[0];
  const duel = session.mode === "duel";
  const defi = session.mode === "defi" && session.challenge;
  const received = defi && !session.creating ? session.challenge : null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-y-auto bg-[rgba(2,6,18,0.9)] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="res-title">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 safe-top">
        <div className="mt-16 text-center">
          {result.stars !== null && (
            <div className="mb-1 flex justify-center">
              <Stars n={result.stars} size={34} />
            </div>
          )}
          <h2 id="res-title" className="display text-[52px] text-[var(--a-gold)]">
            {result.title}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-white/85">{result.subtitle}</p>
        </div>

        {received ? (
          <div className="a-versus mt-5" aria-label="Face-à-face">
            <div className={`a-versus-side ${me.score > received.p ? "is-win" : ""}`}>
              <span className="block truncate text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">Toi</span>
              <span className="display block text-[46px] leading-none">{me.score}</span>
              <span className="block text-[12px] text-[var(--a-muted)]">{me.made}/5</span>
            </div>
            <span className="display self-center text-[24px] text-[var(--a-gold)]">VS</span>
            <div className={`a-versus-side ${received.p > me.score ? "is-win" : ""}`}>
              <span className="block truncate text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">{received.n}</span>
              <span className="display block text-[46px] leading-none">{received.p}</span>
              <span className="block text-[12px] text-[var(--a-muted)]">mêmes tirs</span>
            </div>
          </div>
        ) : duel ? (
          <ol className="mt-5 grid gap-2">
            {result.ranking.map((p, i) => (
              <li key={p.name + i} className="a-choice flex items-center gap-3">
                <span className="display w-7 text-[28px] text-[var(--a-gold)]">{i + 1}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                <span className="flex-1 truncate text-[16px] font-extrabold">{p.name}</span>
                <span className="text-right">
                  <span className="display block text-[26px]">{p.score}</span>
                  <span className="block text-[11px] text-[var(--a-muted)]">{p.made}/5</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Points" value={me.score} />
            <Stat label={session.game === "foot" ? "Buts" : "Paniers"} value={me.made} />
            <Stat label="Meilleure série" value={me.best} />
          </div>
        )}
        {result.rank === 0 && !duel && <p className="mt-3 text-center text-[14px] font-bold text-[var(--a-gold)]">Nouveau record sur cet appareil !</p>}

        {!duel && (
          <div className="mt-3.5 rounded-2xl border border-white/10 bg-black/40 p-3.5 text-center shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/50">
              <span>Série officielle validée</span>
              <span className="text-[var(--a-gold)]">
                {props.serverRank?.isNewRecord ? "🏆 Nouveau record !" : "Record personnel"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="text-3xl font-black text-white">{me.best}</span>
              <span className="text-[12px] text-white/60">
                {session.game === "foot" ? "tirs d'affilée" : "paniers d'affilée"}
              </span>
            </div>
            {props.serverRank && (
              <div className="mt-2.5 flex items-center justify-around border-t border-white/10 pt-2 text-[12px]">
                <div>
                  <span className="text-white/40">Rang semaine :</span>{" "}
                  <strong className="text-[var(--a-gold)]">
                    {props.serverRank.rankWeek > 0 ? `#${props.serverRank.rankWeek}` : "Classé"}
                  </strong>
                </div>
                <div className="h-3.5 w-px bg-white/10" />
                <div>
                  <span className="text-white/40">Tous les temps :</span>{" "}
                  <strong className="text-[var(--a-gold)]">
                    {props.serverRank.rankAllTime > 0 ? `#${props.serverRank.rankAllTime}` : "Classé"}
                  </strong>
                </div>
              </div>
            )}
            {props.onOpenChampions && (
              <button
                type="button"
                onClick={props.onOpenChampions}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-[var(--a-gold)] hover:bg-white/15 active:scale-95 transition-all"
              >
                <Trophy size={13} /> Voir « Les champions du Bloc »
              </button>
            )}
          </div>
        )}

        <div className="mt-auto grid gap-2.5 py-5 safe-bottom">
          {defi ? (
            <>
              <button className="a-btn a-btn-whatsapp w-full text-[17px]" onClick={props.onWhatsApp} autoFocus>
                <WhatsAppIcon /> {session.creating ? "Envoyer le défi sur WhatsApp" : received && me.score > received.p ? "Envoyer ma victoire" : "Envoyer la revanche"}
              </button>
              <button className="a-btn a-btn-secondary w-full" onClick={props.onShare}>
                <Share2 size={18} /> Autre application ou copier le lien
              </button>
              <button className="a-btn a-btn-secondary w-full" onClick={props.onReplay}>
                <RotateCcw size={18} /> {session.creating ? "Rejouer pour améliorer mon score" : "Retenter les mêmes tirs"}
              </button>
            </>
          ) : (
            <>
              {result.canNext ? (
                <button className="a-btn a-btn-primary w-full text-[17px]" onClick={props.onNext} autoFocus>
                  Palier suivant <ChevronRight size={18} />
                </button>
              ) : (
                <button className="a-btn a-btn-primary w-full text-[17px]" onClick={props.onReplay} autoFocus>
                  <RotateCcw size={18} /> {duel ? "Revanche" : "Rejouer"}
                </button>
              )}
              {result.shareable && (
                <button className="a-btn a-btn-whatsapp w-full" onClick={props.onWhatsApp}>
                  <WhatsAppIcon /> Défier un ami sur WhatsApp
                </button>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {result.canNext && !defi && (
              <button className="a-btn a-btn-secondary" onClick={props.onReplay}>
                <RotateCcw size={18} /> Rejouer
              </button>
            )}
            <button className={`a-btn a-btn-ghost ${result.canNext && !defi ? "" : "col-span-2"}`} onClick={props.onHome}>
              Menu des jeux
            </button>
          </div>
          <p className="mt-1 text-center text-[10px] text-white/35">
            ℹ️ Ton profil est conservé sur cet appareil et peut être perdu si les données du navigateur sont effacées.
          </p>
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[var(--a-surface)] px-2 py-3 shadow-[inset_0_0_0_1px_var(--a-line)]">
      <div className="display text-[32px]">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--a-muted)]">{label}</div>
    </div>
  );
}

/** Création / modification du joueur : sexe, nom, numéro (un seul formulaire). */
function ProfileSheet(props: {
  first: boolean;
  initial: { name: string; number: number; female: boolean; character: string };
  reduced: boolean;
  onClose: () => void;
  onSave: (p: { name: string; number: number; female: boolean; character: string }) => void;
}) {
  const [p, setP] = useState(props.initial);
  const [charReady, setCharReady] = useState(true);
  const ok = p.name.trim().length > 0 && charReady;
  return (
    <Sheet
      title={props.first ? "Crée ton joueur" : "Ton joueur"}
      onClose={props.onClose}
      footer={
        <button type="submit" form="profile-form" className="a-btn a-btn-primary w-full text-[17px]" disabled={!ok}>
          {!charReady ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Chargement du modèle 3D...
            </span>
          ) : props.first ? (
            "Entrer dans l'arène"
          ) : (
            "Enregistrer"
          )}
        </button>
      }
    >
      <form
        id="profile-form"
        className="grid min-w-0 grid-cols-1 gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) props.onSave(p);
        }}
      >
        {props.first && <p className="text-[14px] text-[var(--a-muted)]">Ton nom et ton numéro s'afficheront sur ton maillot des Léopards.</p>}
        <div className="mx-auto h-[230px] w-full max-w-[260px]">
          <CharacterPreview
            female={p.female}
            character={p.character}
            name={p.name}
            number={p.number}
            reduced={props.reduced}
            onLoadedChange={setCharReady}
          />
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Tu joues avec</legend>
          <div className="a-seg" role="radiogroup" aria-label="Personnage">
            {[false, true].map((f) => (
              <button type="button" key={String(f)} role="radio" aria-checked={p.female === f} onClick={() => setP({ ...p, female: f, character: charFor(null, f) })}>
                {f ? "Une joueuse" : "Un joueur"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Personnage</legend>
          <div className="a-chars flex flex-wrap gap-1.5" role="radiogroup" aria-label="Personnage">
            {ROSTER.filter((c) => c.female === p.female).map((c) => {
              const active = p.character === c.id;
              const isJersey = hasJersey(c);
              return (
                <button
                  type="button"
                  key={c.id}
                  role="radio"
                  aria-checked={active}
                  className={`group inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold transition-all duration-150 active:scale-95 ${
                    active
                      ? "bg-[var(--a-gold)] text-[#1a1300] shadow-[0_0_12px_rgba(244,196,0,0.35)]"
                      : "bg-white/5 text-white/85 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  }`}
                  onClick={() => setP({ ...p, character: c.id })}
                >
                  <span>{c.label}</span>
                  {c.roleHint && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        active
                          ? "bg-black/20 text-[#1a1300]"
                          : isJersey
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {c.roleHint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
        {hasJersey(p.character) ? (
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <label className="min-w-0">
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Nom sur le maillot</span>
              <input className="a-input" value={p.name} maxLength={14} autoComplete="nickname" placeholder="Ton nom" onChange={(e) => setP({ ...p, name: e.target.value })} required autoFocus={props.first} />
            </label>
            <label>
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Numéro</span>
              <input
                className="a-input text-center"
                inputMode="numeric"
                value={p.number}
                onChange={(e) => setP({ ...p, number: Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
              />
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Nom du joueur</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                Tenue civile · Pas de numéro
              </span>
            </div>
            <input className="a-input" value={p.name} maxLength={14} autoComplete="nickname" placeholder="Ton nom" onChange={(e) => setP({ ...p, name: e.target.value })} required autoFocus={props.first} />
          </div>
        )}
      </form>
    </Sheet>
  );
}

function RecordsSheet({ save, onClose }: { save: SaveData; onClose: () => void }) {
  const [g, setG] = useState<GameId>("foot");
  const list = save.records[g] || [];
  const evo = playerEvolution(save);
  return (
    <Sheet title="Records & Évolution" onClose={onClose}>
      {/* Statistiques d'évolution du joueur */}
      <div className="mb-4 rounded-2xl bg-[rgba(255,255,255,0.06)] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--a-gold)]">
            Rang : {evo.rankTitle}
          </span>
          <span className="text-[12px] font-semibold text-white/70">
            ★ {evo.totalStars} étoiles
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/20 p-2">
            <span className="display block text-[20px] text-white">{evo.goals}</span>
            <span className="text-[11px] font-semibold text-white/60">Buts foot</span>
          </div>
          <div className="rounded-xl bg-black/20 p-2">
            <span className="display block text-[20px] text-white">{evo.baskets}</span>
            <span className="text-[11px] font-semibold text-white/60">Paniers</span>
          </div>
          <div className="rounded-xl bg-black/20 p-2">
            <span className="display block text-[20px] text-[var(--a-gold)]">
              {Math.max(evo.streakFoot, evo.streakBasket)}
            </span>
            <span className="text-[11px] font-semibold text-white/60">Record série</span>
          </div>
        </div>
      </div>

      <div className="a-seg mb-3" role="radiogroup" aria-label="Jeu">
        {(["foot", "basket"] as GameId[]).map((x) => (
          <button type="button" key={x} role="radio" aria-checked={g === x} onClick={() => setG(x)}>
            {GAME_META[x].short}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-[var(--a-muted)]">Aucun score pour l'instant. À toi d'ouvrir le tableau !</p>
      ) : (
        <ol className="grid gap-2 pb-3">
          {list.map((r, i) => (
            <li key={r.date + r.name + i} className="a-choice flex items-center gap-3">
              <span className="display w-7 text-[26px] text-[var(--a-gold)]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold">{r.name}</span>
                <span className="block text-[12px] text-[var(--a-muted)]">
                  {r.mode} · {DIFFS[r.diff]?.label}
                </span>
              </span>
              <span className="display text-[26px]">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="pb-3 text-center text-[12px] text-white/45">Classement enregistré sur cet appareil.</p>
    </Sheet>
  );
}
