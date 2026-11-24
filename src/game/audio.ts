/**
 * Hybrid Audio Manager for DTA - Dhata Te Achi:
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
  fuelVoice: `${import.meta.env.BASE_URL}assets/aistudio/fuel_voice.mp3`,
  smash1: `${import.meta.env.BASE_URL}assets/aistudio/smash_6ba140df.mp3`,
  smash2: `${import.meta.env.BASE_URL}assets/aistudio/smash2_93873c2b.mp3`,
  smash3: `${import.meta.env.BASE_URL}assets/aistudio/smash3_f2919cb0.mp3`,
} as const;

export type MusicMode = 'menu' | 'play' | 'none';

type QueuedSfx = {
  key: string;
  priority: number;
  expiresAt: number;
  start: (done: () => void) => void;
};

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
  private activeSfxClip: HTMLAudioElement | null = null;
  private activeSfxGain: GainNode | null = null;
  private activeSfxKey: string | null = null;
  private finishActiveSfx: (() => void) | null = null;
  private sfxQueue: QueuedSfx[] = [];
  private sfxWatchdog: ReturnType<typeof setTimeout> | null = null;

  private musicMode: MusicMode = 'menu';
  private sfxMuted = false;
  private musicMuted = false;
  private initialized = false;
  private unlocked = false;

  private lastRefuelBeep = 0;
  private lastAnnouncementMs = 0;
  private announcementPlayedThisRide = false;
  private smashIndex = 0;
  private impactCount = 0;

  // --- Sound pacing layer: keep EVERY sound available, but stop them from
  // --- hammering over and over. Short synth "feedback" bursts stay instant;
  // --- the long/repetitive ones get randomized cooldowns so nothing loops.
  private sfxLastMs = new Map<string, number>();
  private ambientHornGapMs = 9000;

  private sfxGapOk(key: string, gapMs: number): boolean {
    const nowMs = performance.now();
    const last = this.sfxLastMs.get(key);
    if (last !== undefined && nowMs - last < gapMs) return false;
    this.sfxLastMs.set(key, nowMs);
    return true;
  }

  private shouldPlayImpactSound(): boolean {
    this.impactCount += 1;
    if (this.impactCount < 3) return false;
    this.impactCount = 0;
    return true;
  }

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.menuMusic = this.createTrack(AUDIO_PATHS.musicMenu, false, 0.34);

      for (const path of Object.values(AUDIO_PATHS)) {
        if (path === AUDIO_PATHS.musicMenu) continue;
        this.sfxCache.set(path, this.createTrack(path, false, 0.78));
      }

      // Retry AudioContext.resume() when the tab becomes visible again — mobile
      // browsers suspend the context when backgrounded and don't auto-resume.
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private createTrack(src: string, loop: boolean, volume: number): HTMLAudioElement {
    const el = new Audio(src);
    el.loop = loop;
    el.preload = 'auto';
    el.volume = volume;
    return el;
  }

  private enqueueSfx(key: string, priority: number, start: QueuedSfx['start'], maxWaitMs = 2500): void {
    if (this.sfxMuted || !this.unlocked) return;
    const now = performance.now();
    this.sfxQueue = this.sfxQueue.filter((item) => item.expiresAt > now);
    if (this.activeSfxKey === key || this.sfxQueue.some((item) => item.key === key)) return;

    this.sfxQueue.push({
      key,
      priority,
      expiresAt: now + maxWaitMs,
      start,
    });
    if (this.sfxQueue.length > 8) {
      this.sfxQueue.sort((a, b) => b.priority - a.priority);
      this.sfxQueue.length = 8;
    }
    this.pumpSfxQueue();
  }

  private pumpSfxQueue(): void {
    if (this.sfxMuted || this.activeSfxKey) return;
    const now = performance.now();
    this.sfxQueue = this.sfxQueue.filter((item) => item.expiresAt > now);
    if (!this.sfxQueue.length) return;

    this.sfxQueue.sort((a, b) => b.priority - a.priority);
    const next = this.sfxQueue.shift()!;
    this.activeSfxKey = next.key;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (this.sfxWatchdog) clearTimeout(this.sfxWatchdog);
      this.sfxWatchdog = null;
      this.activeSfxClip = null;
      this.activeSfxGain?.disconnect();
      this.activeSfxGain = null;
      this.activeSfxKey = null;
      this.finishActiveSfx = null;
      this.pumpSfxQueue();
    };
    this.finishActiveSfx = done;

    try {
      next.start(done);
    } catch (error) {
      done();
      console.error(`Unable to start sound effect "${next.key}"`, error);
    }
  }

  private playProceduralSfx(
    key: string,
    durationSeconds: number,
    createSound: (gain: GainNode, now: number) => void,
    priority = 30,
    maxWaitMs = 2500
  ): void {
    this.enqueueSfx(key, priority, (done) => {
      if (!this.ctx || !this.masterGain || this.sfxMuted) {
        done();
        return;
      }
      const gain = this.ctx.createGain();
      gain.connect(this.masterGain);
      this.activeSfxGain = gain;
      this.sfxWatchdog = setTimeout(done, durationSeconds * 1000 + 50);
      createSound(gain, this.ctx.currentTime);
    }, maxWaitMs);
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
          master.gain.value = this.sfxMuted ? 0 : 0.42;
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
      void this.ctx.resume().then(() => {
        this.syncMusicPlayback();
      }).catch(() => {});
    }

    this.syncMusicPlayback();
  }

  /** Retry AudioContext.resume() when the tab becomes visible (mobile suspend fix). */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
      this.syncMusicPlayback();
    }
  };

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

    const wantMenu = !this.musicMuted && this.musicMode === 'menu';

    if (this.menuMusic) {
      this.menuMusic.volume = this.musicMuted ? 0 : 0.34;
      if (wantMenu) {
        if (!this.menuPlayedOnce && this.menuMusic.paused) {
          // Only mark as played once play() actually succeeds — if it rejects
          // (autoplay blocked, slow load, etc.) we retry on the next sync.
          void this.menuMusic.play().then(() => {
            this.menuPlayedOnce = true;
          }).catch(() => {
            this.menuPlayedOnce = false;
          });
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

  private playMp3Clip(path: string, volume = 0.82, priority = 60, maxWaitMs = 6000): void {
    const base = this.sfxCache.get(path);
    if (!base) return;

    this.enqueueSfx(path, priority, (done) => {
      base.currentTime = 0;
      base.volume = volume;
      this.activeSfxClip = base;
      base.onended = () => {
        base.onended = null;
        done();
      };
      const durationMs = Number.isFinite(base.duration) ? base.duration * 1000 : 0;
      this.sfxWatchdog = setTimeout(() => {
        if (!base.paused && !base.ended) {
          base.pause();
          base.currentTime = 0;
        }
        base.onended = null;
        done();
      }, Math.min(Math.max(durationMs + 1500, 10000), 20000));
      void base.play().catch(() => {
        base.onended = null;
        done();
      });
    }, maxWaitMs);
  }

  public setMuted(mute: boolean): void {
    this.setSfxMuted(mute);
    this.setMusicMuted(mute);
  }

  // SFX cover both the synthesised Web Audio graph (engine, horns, impacts)
  // routed through masterGain and the MP3 one-shots. Music is only the menu
  // loop, so the two can be toggled independently.
  public setSfxMuted(mute: boolean): void {
    this.sfxMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
    if (mute) {
      this.sfxQueue = [];
      this.activeSfxClip?.pause();
      this.activeSfxClip = null;
      this.finishActiveSfx?.();
    }
  }

  public setMusicMuted(mute: boolean): void {
    this.musicMuted = mute;
    this.syncMusicPlayback();
  }

  public isMuted(): boolean {
    return this.sfxMuted || this.musicMuted;
  }

  public isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public updateEngine(speedKmh: number, isBoosting: boolean, active: boolean, tier: 1 | 2 | 3 = 1): void {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const absSpeed = Math.abs(speedKmh);
    const norm = Math.min(absSpeed / 180, 1);
    const tierShift = tier === 3 ? 1.24 : tier === 2 ? 1.12 : 1.0;
    const baseFreq = (42 + norm * 124 + (isBoosting ? 26 : 0)) * tierShift;
    const cutoff = (210 + norm * 920 + (isBoosting ? 460 : 0)) * tierShift;
    const gain = 0.07 + norm * 0.12 + (isBoosting ? 0.05 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * (tier === 3 ? 1.5 : 1.98), now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    this.engineGain.gain.setTargetAtTime(gain, now, 0.06);
  }

  public playHorn(pitchScale = 1, isAmbient = false): void {
    if (isAmbient) {
      // Traffic honks in the distance: keep them, but rare and varied,
      // so the SAME honk never repeats like a loop.
      if (!this.sfxGapOk('ambientHorn', this.ambientHornGapMs)) return;
      this.ambientHornGapMs = 9000 + Math.random() * 9000; // next honk in 9-18s
      pitchScale *= 0.8 + Math.random() * 0.45; // vary every honk
    }
    this.playProceduralSfx('horn', 0.25, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
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
      g.connect(sfxGain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.25);
      o2.stop(now + 0.25);
    }, isAmbient ? 10 : 30);
  }

  public playDing(combo = 1): void {
    // Combo dings fire in bursts — keep them chimey, not machine-gun.
    if (!this.sfxGapOk('ding', 280)) return;
    this.playProceduralSfx('ding', 0.19, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      const f = 540 + Math.min(combo, 10) * 58;
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 1.38, now + 0.12);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.connect(g);
      g.connect(sfxGain);
      o.start(now);
      o.stop(now + 0.19);
    }, 20);
  }

  public playWhoosh(): void {
    // Near-miss swishes come in chains — a short breather keeps them special.
    if (!this.sfxGapOk('whoosh', 600)) return;
    this.playProceduralSfx('whoosh', 0.28, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const bufSize = Math.floor(ctx.sampleRate * 0.28);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.25);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      src.connect(filter);
      filter.connect(g);
      g.connect(sfxGain);
      src.start(now);
    }, 15);
  }

  public playSmash(): void {
    if (!this.shouldPlayImpactSound()) return;
    const smashClips = [AUDIO_PATHS.smash2, AUDIO_PATHS.smash1, AUDIO_PATHS.smash3];
    const clip = smashClips[this.smashIndex % smashClips.length];
    this.smashIndex += 1;
    this.playMp3Clip(clip, 0.85, 75, 8000);
  }

  public playAccidentAnnouncement(): void {
    // Announcement is a long dramatic voice line: play it ONCE per ride only,
    // never again and again on every crash event.
    if (this.announcementPlayedThisRide) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAnnouncementMs < 9500) return;
    this.lastAnnouncementMs = nowMs;
    this.announcementPlayedThisRide = true;
    this.playMp3Clip(AUDIO_PATHS.accidentAnnouncement, 0.92, 85, 8000);
  }

  /** Call when a new ride starts so one-shot sounds (accident announcement) can play again. */
  public resetRideAudio(): void {
    this.announcementPlayedThisRide = false;
    this.lastAnnouncementMs = 0;
    this.impactCount = 0;
  }

  public playBigCrash(): void {
    this.setMusicMode('none');
    this.playMp3Clip(AUDIO_PATHS.bigCrash, 0.95, 100, 8000);
  }

  public playSlap(): void {
    this.playMp3Clip(AUDIO_PATHS.slapReact, 0.95, 90, 8000);
  }

  public playThud(): void {
    // Scraping a wall fires this constantly — space the booms out a bit.
    if (!this.sfxGapOk('thud', 650)) return;
    this.playProceduralSfx('thud', 0.14, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(125, now);
      o.frequency.exponentialRampToValueAtTime(48, now + 0.12);
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      o.connect(g);
      g.connect(sfxGain);
      o.start(now);
      o.stop(now + 0.14);
    }, 25);
  }

  public playPedHit(): void {
    if (!this.shouldPlayImpactSound()) return;
    this.playMp3Clip(AUDIO_PATHS.pedHit, 0.88, 85, 6000);
  }

  public playViolation(): void {
    if (!this.sfxGapOk('violation', 1500)) return;
    this.playProceduralSfx('violation', 0.23, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(280, now);
      o.frequency.setValueAtTime(390, now + 0.08);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.connect(g);
      g.connect(sfxGain);
      o.start(now);
      o.stop(now + 0.23);
    }, 30);
  }

  public playRefuelTick(fuelPercent: number): void {
    const perfNow = performance.now();
    if (perfNow - this.lastRefuelBeep < 900) return;
    this.lastRefuelBeep = perfNow;
    this.playProceduralSfx('refuelTick', 0.11, (sfxGain, now) => {
      const ctx = this.ctx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(360 + (fuelPercent / 100) * 420, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      o.connect(g);
      g.connect(sfxGain);
      o.start(now);
      o.stop(now + 0.11);
    }, 10, 1000);
  }

  /**
   * Short voice line that plays once when the rider stops at a fuel pump and
   * refueling begins. It is queued with priority over the recurring pump ticks.
   */
  public playFuelVoice(): void {
    if (!this.sfxGapOk('fuelVoice', 4000)) return;
    this.playMp3Clip(AUDIO_PATHS.fuelVoice, 0.95, 70, 8000);
  }

  public playTankFull(): void {
    this.playProceduralSfx('tankFull', 0.34, (sfxGain, now) => {
      [523, 659, 784].forEach((freq, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.07);
        g.gain.setValueAtTime(0.18, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
        o.connect(g);
        g.connect(sfxGain);
        o.start(now + idx * 0.07);
        o.stop(now + idx * 0.07 + 0.19);
      });
    }, 50, 5000);
  }

  public playShowroomOpen(): void {
    this.playProceduralSfx('showroomOpen', 0.35, (sfxGain, now) => {
      [587.33, 880].forEach((freq, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.09);
        g.gain.setValueAtTime(0.16, now + idx * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
        o.connect(g);
        g.connect(sfxGain);
        o.start(now + idx * 0.09);
        o.stop(now + idx * 0.09 + 0.26);
      });
    }, 30, 5000);
  }

  public playUpgradeFanfare(): void {
    this.playProceduralSfx('upgradeFanfare', 0.7, (sfxGain, now) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.22, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.34);
        o.connect(g);
        g.connect(sfxGain);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.36);
      });
    }, 40, 5000);
  }

  public playGameOver(): void {
    this.setMusicMode('none');
    this.playMp3Clip(AUDIO_PATHS.gameOver, 0.92, 100, 8000);
  }

  public dispose(): void {
    this.setMusicMode('none');
    this.sfxQueue = [];
    this.activeSfxClip?.pause();
    this.activeSfxClip = null;
    this.finishActiveSfx?.();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
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
