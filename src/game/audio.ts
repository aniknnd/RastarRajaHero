/**
 * Hybrid Audio Manager for Hero Rastar Raja:
 * - Plays the 9 uploaded Bangla/arcade MP3s from /assets/aistudio/*
 * - Layers procedural Web Audio engine synth, horns, near-miss chimes,
 *   wall thuds, refueling ticks, and crisp impact crunch underneath.
 */

const AUDIO_PATHS = {
  musicMenu: `${import.meta.env.BASE_URL}assets/aistudio/music_menu_70aa1b6a.mp3`,
  accidentAnnouncement: `${import.meta.env.BASE_URL}assets/aistudio/accident_sound_58477596.mp3`,
  bigCrash: `${import.meta.env.BASE_URL}assets/aistudio/big_crash_c8b03ff0.mp3`,
  gameOver: `${import.meta.env.BASE_URL}assets/aistudio/game_over_d533bd70.mp3`,
  slapReact: `${import.meta.env.BASE_URL}assets/aistudio/game_over-_c69626c2.mp3`,
  pedHit: `${import.meta.env.BASE_URL}assets/aistudio/ped_hit_7cd56047.mp3`,
  smash1: `${import.meta.env.BASE_URL}assets/aistudio/smash_6ba140df.mp3`,
  smash2: `${import.meta.env.BASE_URL}assets/aistudio/smash2_93873c2b.mp3`,
  smash3: `${import.meta.env.BASE_URL}assets/aistudio/smash3_f2919cb0.mp3`,
} as const;

export type MusicMode = 'menu' | 'play' | 'none';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private menuMusic: HTMLAudioElement | null = null;
  private menuPlayedOnce = false;
  private sfxCache = new Map<string, HTMLAudioElement>();
  private activeVoiceClip: HTMLAudioElement | null = null;

  private musicMode: MusicMode = 'menu';
  private muted = false;
  private initialized = false;
  private unlocked = false;

  private lastRefuelBeep = 0;
  private lastThudTime = 0;
  private lastVoiceStartMs = 0;
  private lastAnnouncementMs = 0;
  private announcementPlayedThisRide = false;
  private smashIndex = 0;

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.menuMusic = this.createTrack(AUDIO_PATHS.musicMenu, false, 0.34);

      for (const path of Object.values(AUDIO_PATHS)) {
        if (path === AUDIO_PATHS.musicMenu) continue;
        this.sfxCache.set(path, this.createTrack(path, false, 0.78));
      }
    }
  }

  private createTrack(src: string, loop: boolean, volume: number): HTMLAudioElement {
    const el = new Audio(src);
    el.loop = loop;
    el.preload = 'auto';
    el.volume = this.muted ? 0 : volume;
    return el;
  }

  public unlock(): void {
    this.unlocked = true;

    if (!this.initialized) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const master = ctx.createGain();
          master.gain.value = this.muted ? 0 : 0.42;
          master.connect(ctx.destination);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 320;
          filter.Q.value = 2.4;

          const engineGain = ctx.createGain();
          engineGain.gain.value = 0.0;

          const osc1 = ctx.createOscillator();
          osc1.type = 'sawtooth';
          osc1.frequency.value = 54;

          const osc2 = ctx.createOscillator();
          osc2.type = 'triangle';
          osc2.frequency.value = 108;

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);

          osc1.start();
          osc2.start();

          this.ctx = ctx;
          this.masterGain = master;
          this.engineOsc = osc1;
          this.engineSubOsc = osc2;
          this.engineFilter = filter;
          this.engineGain = engineGain;
          this.initialized = true;
        }
      } catch {
        // Safe fallback
      }
    } else if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    this.syncMusicPlayback();
  }

  public setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) {
      this.syncMusicPlayback();
      return;
    }
    this.musicMode = mode;
    this.syncMusicPlayback();
  }

  private syncMusicPlayback(): void {
    if (!this.unlocked) return;

    const wantMenu = !this.muted && this.musicMode === 'menu';

    if (this.menuMusic) {
      this.menuMusic.volume = this.muted ? 0 : 0.34;
      if (wantMenu) {
        if (!this.menuPlayedOnce && this.menuMusic.paused) {
          this.menuPlayedOnce = true;
          void this.menuMusic.play().catch(() => {});
        }
      } else {
        this.menuPlayedOnce = false;
        if (!this.menuMusic.paused) {
          this.menuMusic.pause();
          this.menuMusic.currentTime = 0;
        }
      }
    }
  }

  private playMp3Clip(
    path: string,
    volume = 0.82,
    isVoiceLine = true,
    forceInterrupt = false
  ): void {
    if (this.muted || !this.unlocked) return;
    const nowMs = performance.now();

    if (isVoiceLine && !forceInterrupt) {
      // Avoid clipping short dialogue over itself rapidly
      if (
        this.activeVoiceClip &&
        !this.activeVoiceClip.paused &&
        !this.activeVoiceClip.ended &&
        nowMs - this.lastVoiceStartMs < 1350
      ) {
        return;
      }
    }

    const base = this.sfxCache.get(path);
    if (!base) return;

    try {
      if (forceInterrupt && this.activeVoiceClip && !this.activeVoiceClip.paused) {
        this.activeVoiceClip.pause();
        this.activeVoiceClip.currentTime = 0;
      }
      base.currentTime = 0;
      base.volume = this.muted ? 0 : volume;
      if (isVoiceLine) {
        this.activeVoiceClip = base;
        this.lastVoiceStartMs = nowMs;
      }
      void base.play().catch(() => {});
    } catch {
      // Ignore playback race errors
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
    if (mute && this.activeVoiceClip && !this.activeVoiceClip.paused) {
      this.activeVoiceClip.pause();
    }
    this.syncMusicPlayback();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateEngine(speedKmh: number, isBoosting: boolean, active: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const absSpeed = Math.abs(speedKmh);
    const norm = Math.min(absSpeed / 160, 1);
    const baseFreq = 42 + norm * 124 + (isBoosting ? 26 : 0);
    const cutoff = 210 + norm * 920 + (isBoosting ? 460 : 0);
    const gain = 0.07 + norm * 0.12 + (isBoosting ? 0.05 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    this.engineGain.gain.setTargetAtTime(gain, now, 0.06);
  }

  public playHorn(pitchScale = 1): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o1.type = 'sawtooth';
      o2.type = 'sawtooth';
      o1.frequency.setValueAtTime(410 * pitchScale, now);
      o2.frequency.setValueAtTime(515 * pitchScale, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.14, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      o1.connect(g);
      o2.connect(g);
      g.connect(this.masterGain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.25);
      o2.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  public playDing(combo = 1): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      const f = 540 + Math.min(combo, 10) * 58;
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 1.38, now + 0.12);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(now);
      o.stop(now + 0.19);
    } catch {
      // Ignore
    }
  }

  public playWhoosh(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.28);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.25);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    } catch {
      // Ignore
    }
  }

  public playSmash(): void {
    // Rotate through all 3 uploaded smash clips!
    const smashClips = [AUDIO_PATHS.smash2, AUDIO_PATHS.smash1, AUDIO_PATHS.smash3];
    const clip = smashClips[this.smashIndex % smashClips.length];
    this.smashIndex += 1;
    this.playMp3Clip(clip, 0.85, clip !== AUDIO_PATHS.smash2, false);

    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.24);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.32));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 680;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

      noise.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      noise.start(now);

      const chime = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(740, now + 0.04);
      chime.frequency.exponentialRampToValueAtTime(1180, now + 0.18);
      cg.gain.setValueAtTime(0.14, now + 0.04);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      chime.connect(cg);
      cg.connect(this.masterGain);
      chime.start(now + 0.04);
      chime.stop(now + 0.23);
    } catch {
      // Ignore
    }
  }

  public playAccidentAnnouncement(): void {
    // Announcement is a long dramatic voice line: play it ONCE per ride only,
    // never again and again on every crash event.
    if (this.announcementPlayedThisRide) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAnnouncementMs < 9500) return;
    this.lastAnnouncementMs = nowMs;
    this.announcementPlayedThisRide = true;
    this.playMp3Clip(AUDIO_PATHS.accidentAnnouncement, 0.92, true, true);
  }

  /** Call when a new ride starts so one-shot sounds (accident announcement) can play again. */
  public resetRideAudio(): void {
    this.announcementPlayedThisRide = false;
    this.lastAnnouncementMs = 0;
  }

  public playBigCrash(): void {
    this.setMusicMode('none');
    this.playMp3Clip(AUDIO_PATHS.bigCrash, 0.95, true, true);

    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      noise.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      noise.start(now);

      const thud = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(145, now);
      thud.frequency.exponentialRampToValueAtTime(32, now + 0.44);
      tg.gain.setValueAtTime(0.38, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      thud.connect(tg);
      tg.connect(this.masterGain);
      thud.start(now);
      thud.stop(now + 0.47);
    } catch {
      // Ignore
    }
  }

  public playSlap(): void {
    this.playMp3Clip(AUDIO_PATHS.slapReact, 0.95, true, true);

    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.14);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.16));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.58, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noise.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      noise.start(now);
    } catch {
      // Ignore
    }
  }

  public playThud(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const perfNow = performance.now();
    if (perfNow - this.lastThudTime < 220) return;
    this.lastThudTime = perfNow;

    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(125, now);
      o.frequency.exponentialRampToValueAtTime(48, now + 0.12);
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(now);
      o.stop(now + 0.14);
    } catch {
      // Ignore
    }
  }

  public playPedHit(): void {
    this.playMp3Clip(AUDIO_PATHS.pedHit, 0.88, true, false);

    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(340, now);
      o.frequency.exponentialRampToValueAtTime(150, now + 0.16);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(now);
      o.stop(now + 0.18);
    } catch {
      // Ignore
    }
  }

  public playViolation(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(280, now);
      o.frequency.setValueAtTime(390, now + 0.08);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(now);
      o.stop(now + 0.23);
    } catch {
      // Ignore
    }
  }

  public playRefuelTick(fuelPercent: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const perfNow = performance.now();
    if (perfNow - this.lastRefuelBeep < 180) return;
    this.lastRefuelBeep = perfNow;

    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(360 + (fuelPercent / 100) * 420, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(now);
      o.stop(now + 0.11);
    } catch {
      // Ignore
    }
  }

  public playTankFull(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      [523, 659, 784].forEach((freq, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.07);
        g.gain.setValueAtTime(0.18, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
        o.connect(g);
        g.connect(this.masterGain!);
        o.start(now + idx * 0.07);
        o.stop(now + idx * 0.07 + 0.19);
      });
    } catch {
      // Ignore
    }
  }

  public playGameOver(): void {
    this.setMusicMode('none');
    this.playMp3Clip(AUDIO_PATHS.gameOver, 0.92, true, true);

    if (!this.ctx || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      [330, 294, 247, 196].forEach((freq, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, now + idx * 0.11);
        g.gain.setValueAtTime(0.1, now + idx * 0.11);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.22);
        o.connect(g);
        g.connect(this.masterGain!);
        o.start(now + idx * 0.11);
        o.stop(now + idx * 0.11 + 0.23);
      });
    } catch {
      // Ignore
    }
  }

  public dispose(): void {
    this.setMusicMode('none');
    if (this.menuMusic) {
      this.menuMusic.pause();
      this.menuMusic.src = '';
    }
    for (const el of this.sfxCache.values()) {
      el.pause();
      el.src = '';
    }
    this.sfxCache.clear();

    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore
    }
    this.ctx = null;
    this.initialized = false;
  }
}
