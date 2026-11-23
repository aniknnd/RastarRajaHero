/**
 * Motion (gyroscope / device-tilt) steering controller.
 *
 * Projects the W3C `deviceorientation` (beta, gamma) Euler angles into the
 * 3D Earth-UP gravity vector inside the screen's current coordinate frame
 * (portrait / landscape / upside-down). That avoids Euler gimbal lock at
 * upright holding angles (beta ~ 90°) and ±180° flips in landscape mode.
 *
 * Exposes smoothed steering in [-1, 1] (+1 = full left, -1 = full right,
 * matching the engine's yaw convention).
 */

import type { MotionStatus } from './types';

export type { MotionStatus };

type PermissionCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const wrapDeg = (deg: number): number => {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
};

export class MotionController {
  private enabled = false;
  private enabling = false;
  private listening = false;
  private calibrated = false;
  private receivedOrientation = false;

  /** Warmup samples skipped/averaged so a crooked tap frame never locks bias. */
  private warmupSamples: number[] = [];
  /** Neutral tilt offset in degrees (clamped near horizon level). */
  private baseTiltDeg = 0;
  /** Latest unsmoothed tilt angle (used for spike rejection). */
  private lastTiltDeg: number | null = null;

  /** Auto-trim: how long steering has been near zero (seconds). */
  private nearZeroTimer = 0;
  /** Auto-trim: the live unsmoothed tilt used to slowly relax the neutral. */
  private liveTiltDeg = 0;

  /** Unsmoothed steering target from the latest sensor sample. */
  private rawSteer = 0;
  /** Low-pass filtered steering actually reported to the engine. */
  private smoothedSteer = 0;
  /** Latest speed (0..1) reported by the engine, used for speed-aware tilt gain. */
  private latestSpeedNorm = 0;

  private screenAngle = 0;
  private status: MotionStatus = 'off';

  /** Full-lock tilt in degrees (low-speed base; high-speed adds more). */
  private readonly baseMaxTiltDeg = 22;
  /** Extra tilt needed for full lock at top speed (high-speed stability). */
  private readonly highSpeedMaxTiltDeg = 42;
  /** Steady-hand deadzone in degrees at low speed. */
  private readonly baseDeadzoneDeg = 3.2;
  /** Extra deadzone at top speed to absorb hand tremor. */
  private readonly highSpeedDeadzoneDeg = 6.5;
  /** Max allowed neutral offset from true horizon so crooked taps never drift forever. */
  private readonly maxNeutralBiasDeg = 8.0;

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public getStatus(): MotionStatus {
    return this.status;
  }

  public isActive(): boolean {
    return this.status === 'active';
  }

  public isWaiting(): boolean {
    return this.status === 'waiting';
  }

  /**
   * Requests permission (iOS) and starts listening for orientation samples.
   * Must be called from a user gesture so the permission prompt can be shown.
   */
  public async enable(): Promise<boolean> {
    if (this.enabled) return true;
    if (this.enabling) return false;
    if (typeof window === 'undefined') {
      this.status = 'unsupported';
      return false;
    }
    if (window.isSecureContext === false) {
      this.status = 'insecure';
      return false;
    }
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      this.status = 'unsupported';
      return false;
    }

    this.enabling = true;
    try {
      const ctor = window.DeviceOrientationEvent as PermissionCtor;
      if (typeof ctor.requestPermission === 'function') {
        try {
          const result = await ctor.requestPermission();
          if (result !== 'granted') {
            this.status = 'denied';
            return false;
          }
        } catch {
          this.status = 'denied';
          return false;
        }
      }

      this.enabled = true;
      this.receivedOrientation = false;
      this.resetCalibrationState();
      this.screenAngle = this.readScreenAngle();

      window.addEventListener('deviceorientation', this.handleOrientation, true);
      window.addEventListener('orientationchange', this.handleOrientationChange);
      window.addEventListener('resize', this.handleOrientationChange);
      window.screen?.orientation?.addEventListener?.('change', this.handleOrientationChange);
      this.listening = true;
      this.status = 'waiting';
      return true;
    } finally {
      this.enabling = false;
    }
  }

  public disable(): void {
    this.enabled = false;
    this.enabling = false;
    if (this.listening) {
      window.removeEventListener('deviceorientation', this.handleOrientation, true);
      window.removeEventListener('orientationchange', this.handleOrientationChange);
      window.removeEventListener('resize', this.handleOrientationChange);
      window.screen?.orientation?.removeEventListener?.('change', this.handleOrientationChange);
      this.listening = false;
    }
    this.resetCalibrationState();
    this.status = 'off';
  }

  /** Drops the captured neutral so the next steady samples establish straight ahead. */
  public recalibrate(): void {
    if (!this.enabled) return;
    this.resetCalibrationState();
  }

  /**
   * Smoothed steering in [-1, 1] (+1 left, -1 right).
   *
   * Speed-aware: at high speed the steering return-to-center is slower and more
   * damped so a shaky hand at 120 km/h doesn't weave the bike, while at low speed
   * it's quicker for responsive maneuvering.
   *
   * @param dt    Frame delta in seconds.
   * @param speedNorm  Current speed normalized to the bike's top speed (0..1).
   */
  public getSteer(dt: number, speedNorm = 0): number {
    if (!this.enabled || this.status !== 'active') return 0;
    const sn = clamp(speedNorm, 0, 1);
    this.latestSpeedNorm = sn;
    // Low-pass cutoff: ~9 Hz at crawl (responsive) → ~4.5 Hz at top speed (planted).
    const cutoffHz = 9.0 - 4.5 * sn;
    const k = 1 - Math.exp(-cutoffHz * Math.PI * 2 * Math.min(Math.max(dt, 0.001), 0.05));
    this.smoothedSteer += (this.rawSteer - this.smoothedSteer) * k;
    if (Math.abs(this.smoothedSteer) < 0.002 && Math.abs(this.rawSteer) < 0.002) {
      this.smoothedSteer = 0;
    }

    // Auto-trim: if steering has been near zero for a sustained period (~1.2s),
    // slowly relax the captured neutral toward the live tilt angle. This means
    // "hold the phone still and straight → bike goes straight" even if your grip
    // drifts a degree or two over time (fixes the constant-right-drift problem).
    if (this.calibrated && Math.abs(this.smoothedSteer) < 0.06 && Math.abs(this.rawSteer) < 0.06) {
      this.nearZeroTimer += dt;
      if (this.nearZeroTimer > 1.2) {
        const trimRate = 1 - Math.exp(-0.8 * dt);
        this.baseTiltDeg += (this.liveTiltDeg - this.baseTiltDeg) * trimRate;
        this.baseTiltDeg = clamp(this.baseTiltDeg, -this.maxNeutralBiasDeg, this.maxNeutralBiasDeg);
      }
    } else {
      this.nearZeroTimer = 0;
    }
    return this.smoothedSteer;
  }

  private resetCalibrationState(): void {
    this.calibrated = false;
    this.warmupSamples = [];
    this.baseTiltDeg = 0;
    this.lastTiltDeg = null;
    this.rawSteer = 0;
    this.smoothedSteer = 0;
    this.latestSpeedNorm = 0;
    this.nearZeroTimer = 0;
    this.liveTiltDeg = 0;
  }

  private handleOrientation = (event: DeviceOrientationEvent): void => {
    if (!this.enabled) return;
    if (event.beta === null || event.gamma === null) return;
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

    // Keep screen orientation synced even inside iframes where orientationchange may be skipped
    const liveAngle = this.readScreenAngle();
    if (liveAngle !== this.screenAngle) {
      this.screenAngle = liveAngle;
      this.resetCalibrationState();
    }

    if (!this.receivedOrientation) {
      this.receivedOrientation = true;
      this.status = 'active';
    }

    let tiltDeg = this.evalRollRightDeg(event.beta, event.gamma, this.screenAngle);

    // Reject impossible single-frame sensor spikes (>40° jump between adjacent events)
    if (this.lastTiltDeg !== null) {
      const jump = wrapDeg(tiltDeg - this.lastTiltDeg);
      if (Math.abs(jump) > 40) {
        tiltDeg = wrapDeg(this.lastTiltDeg + Math.sign(jump) * 40);
      }
    }
    this.lastTiltDeg = tiltDeg;

    if (!this.calibrated) {
      this.warmupSamples.push(tiltDeg);
      if (this.warmupSamples.length < 8) {
        this.rawSteer = 0;
        return;
      }
      // Pick the steadiest contiguous 4-sample window from the warmup buffer.
      // This avoids locking onto a crooked tap frame when the hand was still settling.
      const buf = this.warmupSamples;
      let bestStart = 0;
      let bestSpread = Infinity;
      for (let i = 0; i <= buf.length - 4; i++) {
        const win = buf.slice(i, i + 4);
        const mean = win.reduce((s, v) => s + v, 0) / 4;
        const spread = win.reduce((s, v) => s + Math.abs(v - mean), 0);
        if (spread < bestSpread) {
          bestSpread = spread;
          bestStart = i;
        }
      }
      const settled = buf.slice(bestStart, bestStart + 4);
      const avg = settled.reduce((sum, v) => sum + v, 0) / settled.length;
      // If user tapped while phone was heavily tilted (>15°), fall back to true level horizon (0°)
      this.baseTiltDeg = Math.abs(avg) <= 15 ? clamp(avg, -this.maxNeutralBiasDeg, this.maxNeutralBiasDeg) : 0;
      this.liveTiltDeg = tiltDeg;
      this.calibrated = true;
      return;
    }

    this.liveTiltDeg = tiltDeg;

    // Speed-aware tilt gain & deadzone (game-quality feel like Asphalt / Traffic Rider):
    //   - At crawl speed: tight deadzone (3.2°) + full lock at 22° → nimble, precise.
    //   - At top speed:   wider deadzone (6.5°) + full lock at 42° → planted, no twitch.
    const sn = this.latestSpeedNorm;
    const maxTilt = this.baseMaxTiltDeg + (this.highSpeedMaxTiltDeg - this.baseMaxTiltDeg) * sn;
    const deadzone = this.baseDeadzoneDeg + (this.highSpeedDeadzoneDeg - this.baseDeadzoneDeg) * sn;

    const deltaDeg = wrapDeg(tiltDeg - this.baseTiltDeg);
    const absDeg = Math.abs(deltaDeg);
    if (absDeg <= deadzone) {
      this.rawSteer = 0;
      return;
    }

    const norm = clamp((absDeg - deadzone) / (maxTilt - deadzone), 0, 1);
    // Gentle expo: soft near center for micro-stability, progressively firmer outward.
    const curved = Math.pow(norm, 1.3);
    // Positive tiltDeg = rolled RIGHT; engine positive steer = LEFT turn, so negate.
    this.rawSteer = -Math.sign(deltaDeg) * curved;
  };

  private handleOrientationChange = (): void => {
    const nextAngle = this.readScreenAngle();
    if (nextAngle !== this.screenAngle) {
      this.screenAngle = nextAngle;
      this.resetCalibrationState();
    }
  };

  private readScreenAngle(): number {
    if (typeof window === 'undefined') return 0;
    const raw =
      window.screen?.orientation?.angle ??
      (window as unknown as { orientation?: number }).orientation ??
      0;
    const normalized = ((raw % 360) + 360) % 360;
    // Snap to nearest 90° cardinal orientation (0, 90, 180, 270)
    return (Math.round(normalized / 90) * 90) % 360;
  }

  /**
   * Computes roll angle in degrees [-90, +90] where positive = tilted RIGHT
   * in the current screen orientation, using the 3D Earth-UP vector projection.
   * Continuous through upright holding angles (beta ~ 90°) and landscape flips.
   */
  private evalRollRightDeg(beta: number, gamma: number, screenAngle: number): number {
    const b = (beta * Math.PI) / 180;
    const g = (gamma * Math.PI) / 180;

    // Earth-UP unit vector in device coordinates (+X right, +Y top, +Z out of screen)
    const ux = -Math.cos(b) * Math.sin(g);
    const uy = Math.sin(b);
    const uz = Math.cos(b) * Math.cos(g);

    let uRight: number;
    let uUp: number;
    switch (screenAngle) {
      case 90:
        uRight = -uy;
        uUp = ux;
        break;
      case 270:
        uRight = uy;
        uUp = -ux;
        break;
      case 180:
        uRight = -ux;
        uUp = -uy;
        break;
      default:
        uRight = ux;
        uUp = uy;
        break;
    }

    const horizon = Math.hypot(uUp, uz);
    return (Math.atan2(-uRight, horizon) * 180) / Math.PI;
  }
}