/**
 * Motion (gyroscope / device-tilt) steering controller.
 *
 * Projects the W3C `deviceorientation` (beta, gamma) Euler angles into the
 * 3D Earth-UP gravity vector inside the screen's current coordinate frame
 * (portrait / landscape / upside-down). This avoids Euler gimbal lock and
 * +-180 degree flips.
 *
 * Exposes smoothed steering in [-1, 1] (+1 = full left, -1 = full right,
 * matching the engine's yaw convention) and throttle in [-1, 1].
 *
 * Improvements over the previous version:
 *  - Pitch is now decoupled from steering roll (steering no longer causes throttle).
 *  - Roll is decoupled from pitch (leaning forward no longer shrinks steering).
 *  - One Euro filter on tilt/pitch: smooth when still, no lag when moving fast.
 *  - Time-based calibration (median of a settled window), not 8 raw samples.
 *  - Sensor timeout recovery (steering comes back after events resume).
 *  - Pitch neutral auto-trim, same as roll.
 *  - Constant hand range; steering LOCK is reduced with speed instead of
 *    forcing the player to tilt 42 degrees at top speed.
 *  - Re-calibrates when the tab becomes visible again.
 */

import type { MotionStatus } from './types';

export type { MotionStatus };

type PermissionCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const wrapDeg = (deg: number): number => {
  let d = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (d === -180) d = 180;
  return d;
};

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One Euro filter (Casiez et al.). Heavy smoothing at low speed (kills jitter),
 * light smoothing at high speed (kills lag).
 */
class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  public reset(): void {
    this.x = null;
    this.dx = 0;
  }

  public filter(value: number, dt: number): number {
    if (this.x === null) {
      this.x = value;
      this.dx = 0;
      return value;
    }
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuroFilter.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuroFilter.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class MotionController {
  private enabled = false;
  private enabling = false;
  private listening = false;
  private calibrated = false;
  private receivedOrientation = false;

  /** Calibration buffers (collected over a short settled window). */
  private calibStartMs = 0;
  private calibTilt: number[] = [];
  private calibPitch: number[] = [];

  /** Neutral roll offset in degrees (clamped near horizon level). */
  private baseTiltDeg = 0;
  /** Neutral pitch offset in degrees (forward/back), captured at calibration. */
  private basePitchDeg = 0;

  /** Latest spike-limited (pre-filter) angles. */
  private lastTiltDeg: number | null = null;
  private lastPitchDeg: number | null = null;

  /** Latest filtered angles. */
  private liveTiltDeg = 0;
  private livePitchDeg = 0;

  /** Auto-trim timers (seconds). */
  private steerTrimTimer = 0;
  private pitchTrimTimer = 0;

  /** Filters (tilt = roll for steering, pitch = lean for throttle). */
  private readonly tiltFilter = new OneEuroFilter(1.6, 0.02);
  private readonly pitchFilter = new OneEuroFilter(1.2, 0.015);

  /** Unsmoothed steering target (before speed-lock scaling). */
  private rawSteer = 0;
  /** Light output low-pass steering reported to the engine. */
  private smoothedSteer = 0;
  /** Unsmoothed throttle target. */
  private rawThrottle = 0;
  /** Low-pass filtered throttle reported to the engine. */
  private smoothedThrottle = 0;
  /** Latest speed (0..1) reported by the engine. */
  private latestSpeedNorm = 0;

  /** Timestamps (performance.now()). */
  private lastSensorMs = 0;
  private lastEventMs = 0;

  private screenAngle = 0;
  private status: MotionStatus = 'off';

  /** Full-lock tilt in degrees. Constant at all speeds so the hand range stays natural. */
  private maxTiltDeg = 30;
  /** Steady-hand deadzone in degrees. */
  private readonly deadzoneDeg = 3.2;
  /**
   * How much steering LOCK is removed at top speed (0..1).
   * 0.2 means at top speed full tilt gives 80% of full steer. Keeps the bike
   * stable at high speed without making the player tilt more.
   */
  private highSpeedLockReduction = 0.2;
  /** Max allowed neutral offset from true horizon so crooked taps never drift forever. */
  private readonly maxNeutralBiasDeg = 8.0;
  /** Calibration timing. */
  private readonly calibSettleMs = 150;
  private readonly calibDurationMs = 600;
  private readonly calibMinSamples = 6;
  /** Forward/back tilt (degrees) for full throttle / full brake. */
  private readonly throttleFullTiltDeg = 28;
  /** Deadzone (degrees) for throttle axis. */
  private readonly throttleDeadzoneDeg = 5.0;
  /** Whether tilt controls throttle. Turn off to use tilt for steering only. */
  private throttleEnabled = true;

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

  /** True while the neutral pose is being captured (show a "hold steady..." hint). */
  public isCalibrating(): boolean {
    return this.enabled && this.status === 'active' && !this.calibrated;
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
      document.addEventListener('visibilitychange', this.handleVisibility);
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
      document.removeEventListener('visibilitychange', this.handleVisibility);
      this.listening = false;
    }
    this.resetCalibrationState();
    this.status = 'off';
    this.lastSensorMs = 0;
  }

  /** Drops the captured neutral so the next steady samples establish straight ahead. */
  public recalibrate(): void {
    if (!this.enabled) return;
    this.resetCalibrationState();
  }

  /**
   * Smoothed steering in [-1, 1] (+1 left, -1 right).
   *
   * Speed-aware: the steering LOCK shrinks as speed rises, so the same hand
   * motion gives a calmer bike at 120 km/h.
   *
   * @param dt         Frame delta in seconds.
   * @param speedNorm  Current speed normalized to the bike's top speed (0..1).
   */
  public getSteer(dt: number, speedNorm = 0): number {
    if (!this.enabled || this.status !== 'active') return 0;
    if (this.checkTimeout()) return 0;
    if (!this.calibrated) return 0;

    const sn = clamp(speedNorm, 0, 1);
    this.latestSpeedNorm = sn;

    const frameDt = clamp(dt, 0.001, 0.05);
    const lock = 1 - this.highSpeedLockReduction * sn;
    const target = this.rawSteer * lock;

    // Light output low-pass (the One Euro filter already did the heavy work).
    // ~11 Hz at crawl -> ~7 Hz at top speed.
    const cutoffHz = 11 - 4 * sn;
    const k = 1 - Math.exp(-cutoffHz * Math.PI * 2 * frameDt);
    this.smoothedSteer += (target - this.smoothedSteer) * k;
    if (Math.abs(this.smoothedSteer) < 0.002 && Math.abs(target) < 0.002) {
      this.smoothedSteer = 0;
    }

    // Auto-trim: if steering has been near zero for ~1.2s, slowly relax the
    // neutral toward the live tilt so a drifting hold angle never causes a pull.
    if (Math.abs(this.smoothedSteer) < 0.06 && Math.abs(this.rawSteer) < 0.06) {
      this.steerTrimTimer += frameDt;
      if (this.steerTrimTimer > 1.2) {
        const trimRate = 1 - Math.exp(-0.8 * frameDt);
        this.baseTiltDeg += (this.liveTiltDeg - this.baseTiltDeg) * trimRate;
        this.baseTiltDeg = clamp(this.baseTiltDeg, -this.maxNeutralBiasDeg, this.maxNeutralBiasDeg);
      }
    } else {
      this.steerTrimTimer = 0;
    }
    return this.smoothedSteer;
  }

  /**
   * Throttle axis from forward/back tilt in [-1, 1] (+1 accelerate, -1 brake).
   * Lean the phone forward (top away) to accelerate, pull back to brake.
   */
  public getThrottle(dt: number): number {
    if (!this.throttleEnabled) return 0;
    if (!this.enabled || this.status !== 'active') return 0;
    if (this.checkTimeout()) return 0;
    if (!this.calibrated) return 0;

    const frameDt = clamp(dt, 0.001, 0.05);
    const k = 1 - Math.exp(-6.0 * frameDt);
    this.smoothedThrottle += (this.rawThrottle - this.smoothedThrottle) * k;
    if (Math.abs(this.smoothedThrottle) < 0.02 && Math.abs(this.rawThrottle) < 0.02) {
      this.smoothedThrottle = 0;
    }

    // Pitch auto-trim: while throttle is idle for ~1.5s, relax the pitch neutral
    // toward the live pitch (the player slowly changed how they hold the phone).
    if (Math.abs(this.rawThrottle) < 0.02 && Math.abs(this.smoothedThrottle) < 0.02) {
      this.pitchTrimTimer += frameDt;
      if (this.pitchTrimTimer > 1.5) {
        const trimRate = 1 - Math.exp(-0.6 * frameDt);
        this.basePitchDeg += wrapDeg(this.livePitchDeg - this.basePitchDeg) * trimRate;
        this.basePitchDeg = clamp(this.basePitchDeg, -60, 60);
      }
    } else {
      this.pitchTrimTimer = 0;
    }
    return this.smoothedThrottle;
  }

  /** Steering sensitivity preset: scales the tilt-to-steer gain. */
  public setSensitivity(preset: 'low' | 'medium' | 'high'): void {
    const scale = preset === 'low' ? 1.35 : preset === 'high' ? 0.75 : 1.0;
    this.maxTiltDeg = 30 * scale;
  }

  /** 0..1: how much steering lock is removed at top speed. */
  public setHighSpeedLockReduction(amount: number): void {
    this.highSpeedLockReduction = clamp(amount, 0, 0.8);
  }

  /** Enable/disable tilt throttle. When disabled, getThrottle() returns 0 (use touch throttle). */
  public setThrottleEnabled(enabled: boolean): void {
    this.throttleEnabled = enabled;
    if (!enabled) {
      this.rawThrottle = 0;
      this.smoothedThrottle = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Returns true if the sensor timed out (and flags the status as waiting). */
  private checkTimeout(): boolean {
    if (performance.now() - this.lastSensorMs > 2000) {
      this.rawSteer = 0;
      this.rawThrottle = 0;
      this.smoothedSteer = 0;
      this.smoothedThrottle = 0;
      this.status = 'waiting';
      return true;
    }
    return false;
  }

  private resetCalibrationState(): void {
    this.calibrated = false;
    this.calibStartMs = 0;
    this.calibTilt = [];
    this.calibPitch = [];
    this.baseTiltDeg = 0;
    this.basePitchDeg = 0;
    this.lastTiltDeg = null;
    this.lastPitchDeg = null;
    this.liveTiltDeg = 0;
    this.livePitchDeg = 0;
    this.rawSteer = 0;
    this.smoothedSteer = 0;
    this.rawThrottle = 0;
    this.smoothedThrottle = 0;
    this.latestSpeedNorm = 0;
    this.steerTrimTimer = 0;
    this.pitchTrimTimer = 0;
    this.lastEventMs = 0;
    this.lastSensorMs = performance.now();
    this.tiltFilter.reset();
    this.pitchFilter.reset();
  }

  private handleOrientation = (event: DeviceOrientationEvent): void => {
    if (!this.enabled) return;
    if (event.beta === null || event.gamma === null) return;
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

    const now = performance.now();
    this.lastSensorMs = now;

    // Keep screen orientation synced even inside iframes where orientationchange may be skipped
    const liveAngle = this.readScreenAngle();
    if (liveAngle !== this.screenAngle) {
      this.screenAngle = liveAngle;
      this.resetCalibrationState();
    }

    if (!this.receivedOrientation) {
      this.receivedOrientation = true;
    }
    // Recover from a sensor timeout: events are flowing again.
    if (this.status === 'waiting') {
      this.status = 'active';
    }

    const dt = this.lastEventMs > 0 ? clamp((now - this.lastEventMs) / 1000, 0.004, 0.1) : 1 / 60;
    this.lastEventMs = now;

    let tiltDeg = this.evalRollRightDeg(event.beta, event.gamma, this.screenAngle);
    let pitchDeg = this.evalPitchDeg(event.beta, event.gamma, this.screenAngle);

    // Reject impossible single-frame sensor spikes (>40 degree jump between adjacent events)
    if (this.lastTiltDeg !== null) {
      const jump = wrapDeg(tiltDeg - this.lastTiltDeg);
      if (Math.abs(jump) > 40) tiltDeg = wrapDeg(this.lastTiltDeg + Math.sign(jump) * 40);
    }
    if (this.lastPitchDeg !== null) {
      const jump = wrapDeg(pitchDeg - this.lastPitchDeg);
      if (Math.abs(jump) > 40) pitchDeg = wrapDeg(this.lastPitchDeg + Math.sign(jump) * 40);
    }
    this.lastTiltDeg = tiltDeg;
    this.lastPitchDeg = pitchDeg;

    // One Euro filtering
    const fTilt = this.tiltFilter.filter(tiltDeg, dt);
    const fPitch = this.pitchFilter.filter(pitchDeg, dt);
    this.liveTiltDeg = fTilt;
    this.livePitchDeg = fPitch;

    // ---- Calibration: median of a settled time window ----
    if (!this.calibrated) {
      if (this.calibStartMs === 0) this.calibStartMs = now;
      const elapsed = now - this.calibStartMs;

      // Skip the first moment (the hand is still settling after the tap).
      if (elapsed >= this.calibSettleMs) {
        this.calibTilt.push(tiltDeg);
        this.calibPitch.push(pitchDeg);
      }

      this.rawSteer = 0;
      this.rawThrottle = 0;

      if (elapsed >= this.calibDurationMs && this.calibTilt.length >= this.calibMinSamples) {
        const tiltMed = median(this.calibTilt);
        const pitchMed = median(this.calibPitch);
        // If the phone was heavily tilted at tap time (>15 degrees), fall back to true level (0).
        this.baseTiltDeg =
          Math.abs(tiltMed) <= 15 ? clamp(tiltMed, -this.maxNeutralBiasDeg, this.maxNeutralBiasDeg) : 0;
        this.basePitchDeg = clamp(pitchMed, -60, 60);
        this.calibTilt = [];
        this.calibPitch = [];
        this.calibrated = true;
      }
      return;
    }

    // ---- Throttle axis (forward/back lean) ----
    if (this.throttleEnabled) {
      const pitchDelta = wrapDeg(fPitch - this.basePitchDeg);
      const absPitch = Math.abs(pitchDelta);
      if (absPitch <= this.throttleDeadzoneDeg) {
        this.rawThrottle = 0;
      } else {
        const pitchNorm = clamp(
          (absPitch - this.throttleDeadzoneDeg) / (this.throttleFullTiltDeg - this.throttleDeadzoneDeg),
          0,
          1,
        );
        // Smoothstep for gentle modulation near center.
        this.rawThrottle = Math.sign(pitchDelta) * (pitchNorm * pitchNorm * (3 - 2 * pitchNorm));
      }
    } else {
      this.rawThrottle = 0;
    }

    // ---- Steering axis (left/right roll) ----
    // Constant hand range at all speeds. Landscape is held more steadily, so tighten slightly.
    const isLandscape = this.screenAngle === 90 || this.screenAngle === 270;
    const maxTilt = this.maxTiltDeg * (isLandscape ? 0.85 : 1.0);
    const deadzone = this.deadzoneDeg * (isLandscape ? 0.8 : 1.0);

    const deltaDeg = wrapDeg(fTilt - this.baseTiltDeg);
    const absDeg = Math.abs(deltaDeg);
    if (absDeg <= deadzone) {
      this.rawSteer = 0;
      return;
    }

    const norm = clamp((absDeg - deadzone) / (maxTilt - deadzone), 0, 1);
    // Gentle expo: soft near center for micro-stability, firmer outward.
    const curved = Math.pow(norm, 1.4);
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

  /** Re-capture the neutral pose when the player returns to the tab/app. */
  private handleVisibility = (): void => {
    if (!this.enabled) return;
    if (document.visibilityState === 'visible') {
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
    // Snap to nearest 90 degree cardinal orientation (0, 90, 180, 270)
    return (Math.round(normalized / 90) * 90) % 360;
  }

  /**
   * Earth-UP unit vector in the SCREEN frame.
   * right = toward the screen's right edge, up = toward the screen's top edge,
   * out = out of the screen toward the player's face.
   */
  private earthUpInScreenFrame(
    beta: number,
    gamma: number,
    screenAngle: number,
  ): { right: number; up: number; out: number } {
    const b = (beta * Math.PI) / 180;
    const g = (gamma * Math.PI) / 180;

    // Earth-UP in device coordinates (+X right, +Y top, +Z out of screen)
    const ux = -Math.cos(b) * Math.sin(g);
    const uy = Math.sin(b);
    const uz = Math.cos(b) * Math.cos(g);

    switch (screenAngle) {
      case 90:
        return { right: -uy, up: ux, out: uz };
      case 270:
        return { right: uy, up: -ux, out: uz };
      case 180:
        return { right: -ux, up: -uy, out: uz };
      default:
        return { right: ux, up: uy, out: uz };
    }
  }

  /**
   * Roll in degrees where positive = tilted RIGHT in the current screen
   * orientation (steering-wheel rotation). Uses atan2(right, up), so leaning the
   * phone forward/back does not change it. `up` is floored so it stays continuous
   * and bounded when the phone is held nearly flat.
   */
  private evalRollRightDeg(beta: number, gamma: number, screenAngle: number): number {
    const { right, up } = this.earthUpInScreenFrame(beta, gamma, screenAngle);
    return (Math.atan2(-right, Math.max(up, 0.15)) * 180) / Math.PI;
  }

  /**
   * Pitch in degrees: 0 = upright, positive = top of phone tilted AWAY from the
   * rider (forward lean -> accelerate), negative = pulled back (brake).
   * Measured between the out-of-screen axis and the in-screen plane magnitude
   * (hypot(right, up)), so steering roll does NOT change it.
   */
  private evalPitchDeg(beta: number, gamma: number, screenAngle: number): number {
    const { right, up, out } = this.earthUpInScreenFrame(beta, gamma, screenAngle);
    return (Math.atan2(out, Math.hypot(right, up)) * 180) / Math.PI;
  }
}