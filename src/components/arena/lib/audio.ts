/**
 * Sons synthétisés (Web Audio) + playlist officielle optionnelle.
 * Aucun fichier son pour les effets : tout est généré, donc léger.
 */

const TRACKS = [
  { file: "oh-yaya.mp3", title: "Oh Yaya" },
  { file: "ti-na-trois.mp3", title: "Tout droit Ti Na Trois" },
  { file: "esimbi-mondial.mp3", title: "Esimbi, Mondial" },
  { file: "rendez-vous-destin.mp3", title: "Rendez-vous avec le destin" }
];

class ArenaAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  crowdGain: GainNode | null = null;
  noise: AudioBuffer | null = null;
  enabled = true;
  musicOn = false;
  music: HTMLAudioElement | null = null;
  trackIdx = Math.floor(Math.random() * TRACKS.length);
  onTrack: ((title: string) => void) | null = null;

  private drumTimer: any = null;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.pauseAll();
        } else if (this.enabled) {
          this.resumeAll();
        }
      });
    }
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startCrowdBed();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  private startCrowdBed() {
    if (!this.ctx || !this.noise || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.035;
    src.connect(bp).connect(this.crowdGain).connect(this.master);
    src.start();
  }

  private burst(opts: { dur: number; freq: number; q?: number; type?: BiquadFilterType; gain: number; attack?: number; sweep?: number }) {
    if (!this.ctx || !this.noise || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", to?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  kick(power = 0.7) {
    const pitch = 130 + (Math.random() - 0.5) * 20;
    this.tone(pitch, 0.13, 0.52 * power + 0.22, "sine", 45);
    this.burst({ dur: 0.08, freq: 1700 + (Math.random() - 0.5) * 300, q: 0.7, gain: 0.26 });
  }
  bounce(v = 0.5) {
    this.tone(110 + (Math.random() - 0.5) * 15, 0.09, Math.min(0.4, v * 0.5), "sine", 58);
  }
  net() {
    this.burst({ dur: 0.42, freq: 3000, q: 0.5, gain: 0.22, type: "highpass", attack: 0.02 });
  }
  swish() {
    this.burst({ dur: 0.32, freq: 4800, sweep: 2300, q: 0.8, gain: 0.24, attack: 0.03 });
  }
  post() {
    // Impact métallique franc avec double harmonique brillante
    this.tone(920, 0.65, 0.22, "triangle", 900);
    this.tone(1380, 0.48, 0.12, "sine", 1340);
    this.tone(2400, 0.2, 0.08, "square", 2200);
    this.burst({ dur: 0.06, freq: 2800, q: 2.2, gain: 0.18 });
  }
  drum(accent = false) {
    const f = accent ? 78 : 65;
    this.tone(f, 0.22, accent ? 0.38 : 0.24, "sine", 38);
    this.burst({ dur: 0.08, freq: 650, q: 1.1, gain: accent ? 0.16 : 0.09 });
  }
  rim() {
    this.tone(520, 0.28, 0.16, "triangle", 480);
    this.tone(1180, 0.18, 0.06, "square", 1100);
  }
  glove() {
    this.burst({ dur: 0.12, freq: 920, q: 1.2, gain: 0.38 });
    this.tone(95, 0.11, 0.32, "sine", 55);
  }
  whistle() {
    this.tone(2600, 0.32, 0.12, "sine", 2500);
    this.tone(2700, 0.32, 0.06, "square", 2650);
  }
  buzzer() {
    this.tone(220, 0.7, 0.18, "sawtooth", 210);
    this.tone(330, 0.7, 0.1, "square", 320);
  }
  tick() {
    this.tone(1400, 0.05, 0.06, "square");
  }
  crowd(kind: "goal" | "ooh" | "groan" | "cheer") {
    if (kind === "goal") {
      this.burst({ dur: 3.2, freq: 680, q: 0.35, gain: 0.58, attack: 0.12 });
      this.burst({ dur: 2.4, freq: 1450, q: 0.55, gain: 0.32, attack: 0.1 });
      this.burst({ dur: 1.6, freq: 2200, q: 0.8, gain: 0.18, attack: 0.25 });
    } else if (kind === "cheer") {
      this.burst({ dur: 1.8, freq: 800, q: 0.5, gain: 0.35, attack: 0.1 });
    } else if (kind === "ooh") {
      this.burst({ dur: 1.3, freq: 440, sweep: 320, q: 1.4, gain: 0.32, attack: 0.08 });
    } else {
      // groan : déception après arrêt ou tir hors cadre
      this.burst({ dur: 1.6, freq: 340, sweep: 200, q: 1.2, gain: 0.32, attack: 0.1 });
      this.tone(180, 0.5, 0.08, "sine", 120, 0.05);
    }
  }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 0.12, "triangle", undefined, i * 0.11));
  }

  /* ---------- Musique ---------- */
  get trackTitle() {
    return TRACKS[this.trackIdx].title;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.playTrack();
    else this.music?.pause();
  }
  nextTrack() {
    this.trackIdx = (this.trackIdx + 1) % TRACKS.length;
    if (this.musicOn) this.playTrack();
    this.onTrack?.(this.trackTitle);
  }
  private playTrack() {
    if (typeof window === "undefined") return;
    if (!this.music) {
      this.music = new Audio();
      this.music.volume = 0.32;
      this.music.addEventListener("ended", () => this.nextTrack());
    }
    const src = `/audio/jeu/${TRACKS[this.trackIdx].file}`;
    if (!this.music.src.endsWith(src)) this.music.src = src;
    this.music.play().catch(() => {});
    this.onTrack?.(this.trackTitle);
  }
  pauseAll() {
    this.music?.pause();
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
  }
  resumeAll() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    if (this.musicOn) this.music?.play().catch(() => {});
  }
}

export const audio = new ArenaAudio();
