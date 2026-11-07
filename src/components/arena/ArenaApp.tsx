import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Lock, Minus, Music, Play, Plus, RotateCcw, Share2, Swords, Trophy, Volume2, VolumeX } from "lucide-react";
import "./arena.css";
import GameView, { type Hud, type Splash } from "./GameView";
import type { ShotOutcome, FootSetup } from "./engine/foot";
import type { BasketSetup } from "./engine/basket";
import {
  BASKET_CHRONO, BASKET_DUEL, BASKET_STAGES, CHRONO_SECONDS, DIFFS, FOOT_DUEL, FOOT_STAGES, GAME_META, MODE_META,
  comboMult, starsFor, survivalStage, type BasketStage, type Difficulty, type FootStage, type GameId, type Mode
} from "./lib/config";
import { addRecord, cleanName, loadSave, persist, progressOf, type SaveData, DEFAULT_SAVE } from "./lib/storage";
import { challengeUrl, decodeChallenge, type Challenge } from "./lib/challenge";
import { audio } from "./lib/audio";
import { randomSeed } from "./lib/rng";
import { CharacterPreview, ConfirmModal, FimbuMini, GamePreview, Sheet, Stars, Toast, useReducedMotion } from "./ui";
import { LOGO_BL, LOGO_RDC } from "./engine/scene";

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
  const [screen, setScreen] = useState<"home" | "play" | "results">("home");
  const [sheet, setSheet] = useState<null | "setup" | "records" | "pause" | "profile">(null);
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

  // chargement
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
    // premier passage : on crée son joueur (sexe, nom, numéro) avant tout
    if (!data.name) setOnboarding(true);
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
    setStagePick(Math.max(0, Math.min(4, prog.unlocked - 1)));
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

  /* ---------------- Chrono global (basket) ---------------- */
  const playing = screen === "play" && !sheet && handoff === null && !tutorial && !confirmQuit;
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
        return finish({ ...next, over: true });
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
      title = passed ? (s.stageIdx === 4 ? "Champion !" : "Palier réussi !") : "Pas cette fois";
      subtitle = passed
        ? `${players[0].made}/${stage.shots} · ${stage.name}`
        : `Il fallait ${stage.toPass} ${s.game === "foot" ? "buts" : "paniers"} sur ${stage.shots}. Tu en as ${players[0].made}.`;
      canNext = passed && s.stageIdx < 4;
      const key = `${s.game}:${s.diff}`;
      update((d) => {
        const prog = progressOf(d, s.game, s.diff);
        const st = [...prog.stars];
        st[s.stageIdx] = Math.max(st[s.stageIdx] || 0, stars || 0);
        const unlocked = passed ? Math.max(prog.unlocked, Math.min(5, s.stageIdx + 2)) : prog.unlocked;
        return { ...d, progress: { ...d.progress, [key]: { unlocked, stars: st } } };
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
      won = me.score > s.challenge.p;
      title = won ? "Défi relevé !" : me.score === s.challenge.p ? "Égalité parfaite" : "Défi perdu";
      subtitle = won
        ? `Tu bats ${s.challenge.n} de ${me.score - s.challenge.p} points.`
        : `${s.challenge.n} garde l'avantage (${s.challenge.p} pts). Renvoie-lui un défi !`;
    }
    // classement local (appareil)
    if (s.mode !== "duel") {
      const me = players[0];
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
        shareable: s.mode === "carriere" || s.mode === "defi" || s.mode === "duel"
      });
      setScreen("results");
    }, 1700);
  }

  /* ---------------- Actions ---------------- */

  function replay(nextStage = false) {
    if (!session) return;
    setStagePick(nextStage ? Math.min(4, session.stageIdx + 1) : session.stageIdx);
    setSetupGame(session.game);
    setSetupMode(session.mode);
    setTimeout(() => {
      // relance immédiate avec les mêmes joueurs
      const s0 = session;
      const players = s0.players.map((p) => newPlayer(p.name, p.number, p.color, s0.mode === "survie" || s0.mode === "chrono" ? 10 : 5, p.female));
      setSession({
        ...s0,
        stageIdx: nextStage ? Math.min(4, s0.stageIdx + 1) : s0.stageIdx,
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

  async function share() {
    if (!session) return;
    const me = session.mode === "duel" ? [...session.players].sort((a, b) => b.score - a.score)[0] : session.players[0];
    const c: Challenge = {
      g: session.game,
      st: session.mode === "carriere" ? session.stageIdx + 1 : session.mode === "defi" && session.challenge ? session.challenge.st : 0,
      d: session.diff,
      seed: session.seed,
      n: me.name,
      p: me.score
    };
    const url = challengeUrl(c);
    const text = `${me.name} te défie aux ${GAME_META[session.game].title} de l'Arène des Léopards : ${me.score} points. Tu peux faire mieux ?`;
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
      reduced
    };
    // dernier tir d'une série de 5 (carrière, duel, défi) : un but déclenche le fimbu
    const finale = session.mode !== "survie" && session.shot === (stage as FootStage).shots - 1;
    if (session.game === "foot") return { ...base, stage: stage as FootStage, history: p.history, finale } as FootSetup;
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
          reduced={reduced}
          challenge={challenge}
          onPick={(g) => openSetup(g, "carriere")}
          onDuel={() => openSetup("foot", "duel")}
          onChallenge={() => challenge && openSetup(challenge.g, "defi")}
          onRecords={() => setSheet("records")}
          onSound={toggleSound}
          onProfile={() => setSheet("profile")}
        />
      )}

      {screen !== "home" && session && engineSetup && hud && (
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
          onReplay={() => replay(false)}
          onNext={() => replay(true)}
          onShare={share}
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
          challenge={challenge}
          prog={prog}
          onGame={(g) => {
            setSetupGame(g);
            if (setupMode === "survie" && g === "basket") setSetupMode("chrono");
            if (setupMode === "chrono" && g === "foot") setSetupMode("survie");
            setStagePick(Math.max(0, progressOf(save, g, save.diff).unlocked - 1));
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
          onStart={start}
        />
      )}
      {sheet === "records" && <RecordsSheet save={save} onClose={() => setSheet(null)} />}
      {(onboarding || sheet === "profile") && (
        <ProfileSheet
          first={onboarding}
          initial={{ name: save.name, number: save.number || 10, female: !!save.female }}
          reduced={reduced}
          onClose={() => {
            if (!onboarding) setSheet(null);
          }}
          onSave={(pr) => {
            const n = cleanName(pr.name, "Léopard");
            update((d) => ({ ...d, name: n, number: pr.number, female: pr.female }));
            setSolo({ name: n, number: pr.number, female: pr.female });
            setNames((prev) => [n, ...prev.slice(1)]);
            setGenders((prev) => [pr.female, ...prev.slice(1)]);
            setSheet(null);
            if (onboarding) {
              setOnboarding(false);
              if (initialGame) openSetup(initialGame, "carriere");
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
    </div>
  );
}

/* ================================================================== */
/* Accueil : les deux jeux côte à côte                                */
/* ================================================================== */

function Home(props: {
  save: SaveData;
  reduced: boolean;
  challenge: Challenge | null;
  onPick: (g: GameId) => void;
  onDuel: () => void;
  onChallenge: () => void;
  onRecords: () => void;
  onSound: () => void;
  onProfile: () => void;
}) {
  const { save } = props;
  const best = (g: GameId) => (save.records[g] || [])[0]?.score ?? 0;
  const prog = (g: GameId) => progressOf(save, g, save.diff);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="safe-top flex items-center justify-between px-4 pb-2">
        <a href="/" className="a-btn a-btn-ghost -ml-3 min-h-[44px] px-3 text-[14px]" aria-label="Retour au site Bloc Léopards">
          <ArrowLeft size={18} /> Site
        </a>
        <button className="a-btn a-btn-secondary ml-auto mr-2 min-h-[44px] max-w-[60%] px-3 text-[13px]" onClick={props.onProfile} aria-label="Modifier ton joueur">
          <span className="truncate">{save.name ? `${save.female ? "Joueuse" : "Joueur"} · ${save.name} · ${save.number}` : "Crée ton joueur"}</span>
          <Pencil size={14} />
        </button>
        <button className="a-icon-btn" onClick={props.onSound} aria-label={save.sound ? "Couper le son" : "Activer le son"} aria-pressed={save.sound}>
          {save.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
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

      <main className="mx-auto mt-4 w-full max-w-3xl flex-1 px-4">
        {props.challenge && (
          <button className="a-choice mb-3 flex items-center gap-3" onClick={props.onChallenge}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--a-red)]">
              <Swords size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold">{props.challenge.n} te défie</span>
              <span className="block text-[13px] text-[var(--a-muted)]">
                {GAME_META[props.challenge.g].short} · {props.challenge.p} points à battre
              </span>
            </span>
            <ChevronRight size={20} className="text-[var(--a-gold)]" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {(["foot", "basket"] as GameId[]).map((g) => (
            <button key={g} className="a-game-card" onClick={() => props.onPick(g)} aria-label={`Jouer : ${GAME_META[g].title}`}>
              <div className="aspect-[4/4.2] w-full sm:aspect-[4/3]">
                <GamePreview game={g} reduced={props.reduced} />
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--a-gold)]">{GAME_META[g].short}</span>
                <span className="display mt-0.5 text-[25px] sm:text-[34px]">{GAME_META[g].title}</span>
                <span className="mt-1 flex items-center gap-2 text-[12px] text-[var(--a-muted)]">
                  <span className="font-bold text-white/85">Palier {prog(g).unlocked}/5</span>
                  <span aria-label="Étoiles gagnées">★ {prog(g).stars.reduce((a, b) => a + b, 0)}/15</span>
                </span>
                {best(g) > 0 && <span className="mt-0.5 text-[12px] text-white/70">Record : {best(g)} pts</span>}
                <span className="h-3" aria-hidden="true" />
                <span className="a-btn a-btn-primary mt-auto min-h-[44px] w-full text-[15px]">
                  <Play size={16} fill="currentColor" /> Jouer
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <button className="a-btn a-btn-secondary w-full" onClick={props.onRecords}>
            <Trophy size={18} /> Records
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
  challenge: Challenge | null;
  prog: (g: GameId) => { unlocked: number; stars: number[] };
  onGame: (g: GameId) => void;
  onMode: (m: Mode) => void;
  onStage: (i: number) => void;
  onDiff: (d: Difficulty) => void;
  onNames: (n: string[]) => void;
  genders: boolean[];
  onGenders: (g: boolean[]) => void;
  onSolo: (s: { name: string; number: number; female: boolean }) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  const { game, mode, save } = props;
  const isDefi = mode === "defi" && props.challenge;
  const g = isDefi ? props.challenge!.g : game;
  const prog = props.prog(g);
  const stages = g === "foot" ? FOOT_STAGES : BASKET_STAGES;
  const modes: Mode[] = [...GAME_META[g].modes, ...(props.challenge && props.challenge.g === g ? (["defi"] as Mode[]) : [])];
  const soloOk = props.solo.name.trim().length > 0;
  const duelOk = props.names.every((n) => n.trim().length > 0);
  const canStart = mode === "duel" ? duelOk : soloOk;
  return (
    <Sheet
      title={isDefi ? "Relever le défi" : GAME_META[g].title}
      onClose={props.onClose}
      footer={
        <button type="submit" form="setup-form" className="a-btn a-btn-primary w-full text-[17px]" disabled={!canStart}>
          <Play size={18} fill="currentColor" /> {mode === "duel" ? "Lancer le duel" : "C'est parti"}
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
        {!isDefi && (
          <div className="a-seg" role="radiogroup" aria-label="Jeu">
            {(["foot", "basket"] as GameId[]).map((x) => (
              <button type="button" key={x} role="radio" aria-checked={game === x} onClick={() => props.onGame(x)}>
                {GAME_META[x].short}
              </button>
            ))}
          </div>
        )}

        {isDefi ? (
          <div className="a-choice" aria-live="polite">
            <div className="text-[15px] font-extrabold">
              {props.challenge!.n} a marqué {props.challenge!.p} points
            </div>
            <div className="text-[13px] text-[var(--a-muted)]">
              Mêmes conditions que ton ami · difficulté {DIFFS[props.challenge!.d].label}
            </div>
          </div>
        ) : (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Mode</legend>
            <div className="grid gap-2" role="radiogroup">
              {modes.map((m) => (
                <button type="button" key={m} role="radio" aria-checked={mode === m} className="a-choice" onClick={() => props.onMode(m)}>
                  <span className="block text-[15px] font-extrabold">{MODE_META[m].label}</span>
                  <span className="block text-[13px] text-[var(--a-muted)]">{MODE_META[m].hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {mode === "carriere" && (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Palier</legend>
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
        )}

        {!isDefi && (
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
        )}

        {mode === "duel" ? (
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
        ) : (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Ton maillot</legend>
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <label>
                <span className="sr-only">Ton nom</span>
                <input
                  className="a-input"
                  value={props.solo.name}
                  maxLength={14}
                  autoComplete="nickname"
                  placeholder="Ton nom"
                  onChange={(e) => props.onSolo({ ...props.solo, name: e.target.value })}
                  required
                />
              </label>
              <label>
                <span className="sr-only">Numéro</span>
                <input
                  className="a-input text-center"
                  inputMode="numeric"
                  value={props.solo.number}
                  onChange={(e) => props.onSolo({ ...props.solo, number: Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                  aria-label="Numéro de maillot"
                />
              </label>
            </div>
            <div className="a-seg mt-2" role="radiogroup" aria-label="Personnage">
              {[false, true].map((f) => (
                <button type="button" key={String(f)} role="radio" aria-checked={props.solo.female === f} onClick={() => props.onSolo({ ...props.solo, female: f })}>
                  {f ? "Joueuse" : "Joueur"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-[var(--a-muted)]">Ton nom s'affiche sur le maillot et au classement.</p>
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

function Results(props: { result: Result; session: Session; reduced: boolean; onReplay: () => void; onNext: () => void; onShare: () => void; onHome: () => void }) {
  const { result, session } = props;
  const me = session.players[0];
  const duel = session.mode === "duel";
  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-y-auto bg-[rgba(2,6,18,0.9)] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="res-title">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 safe-top">
        {result.won && (
          <div className="mx-auto mt-2 h-[170px] w-full max-w-[320px]">
            <FimbuMini reduced={props.reduced} name={duel ? result.ranking[0].name : me.name} number={duel ? result.ranking[0].number : me.number} female={duel ? result.ranking[0].female : me.female} />
          </div>
        )}
        <div className={`text-center ${result.won ? "" : "mt-16"}`}>
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

        {duel ? (
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

        <div className="mt-auto grid gap-2.5 py-5 safe-bottom">
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
            <button className="a-btn a-btn-secondary w-full" onClick={props.onShare}>
              <Share2 size={18} /> Défier un ami
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {result.canNext && (
              <button className="a-btn a-btn-secondary" onClick={props.onReplay}>
                <RotateCcw size={18} /> Rejouer
              </button>
            )}
            <button className={`a-btn a-btn-ghost ${result.canNext ? "" : "col-span-2"}`} onClick={props.onHome}>
              Menu des jeux
            </button>
          </div>
        </div>
      </div>
    </div>
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
  initial: { name: string; number: number; female: boolean };
  reduced: boolean;
  onClose: () => void;
  onSave: (p: { name: string; number: number; female: boolean }) => void;
}) {
  const [p, setP] = useState(props.initial);
  const ok = p.name.trim().length > 0;
  return (
    <Sheet
      title={props.first ? "Crée ton joueur" : "Ton joueur"}
      onClose={props.onClose}
      footer={
        <button type="submit" form="profile-form" className="a-btn a-btn-primary w-full text-[17px]" disabled={!ok}>
          {props.first ? "Entrer dans l'arène" : "Enregistrer"}
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
          <CharacterPreview female={p.female} name={p.name} number={p.number} reduced={props.reduced} />
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--a-muted)]">Tu joues avec</legend>
          <div className="a-seg" role="radiogroup" aria-label="Personnage">
            {[false, true].map((f) => (
              <button type="button" key={String(f)} role="radio" aria-checked={p.female === f} onClick={() => setP({ ...p, female: f })}>
                {f ? "Une joueuse" : "Un joueur"}
              </button>
            ))}
          </div>
        </fieldset>
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
      </form>
    </Sheet>
  );
}

function RecordsSheet({ save, onClose }: { save: SaveData; onClose: () => void }) {
  const [g, setG] = useState<GameId>("foot");
  const list = save.records[g] || [];
  return (
    <Sheet title="Records" onClose={onClose}>
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
