/**
 * Motion (gyroscope / device-tilt) steering controller.
 *
 * Reads the W3C `deviceorientation` event, calibrates a neutral "hold" angle
 * and exposes a smoothed steering value in [-1, 1] where -1 = full right and
 * +1 = full left (matching the engine's yaw convention).
 *
 * Handles iOS 13+ permission requests (must be triggered from a user gesture)
 * and re-maps the tilt axis for portrait / landscape screen orientations.
 */

export type MotionStatus = 'off' | 'waiting' | 'active' | 'unsupported' | 'denied';

type OrientationPermissionCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export class MotionController {
  private enabled = false;
  private enabling = false;
  private listening = false;
  private calibrated = false;
  private receivedOrientation = false;

  /** Tilt (degrees) captured when motion control was enabled / last recentered. */
  private baseTilt = 0;
  /** Unsmoothed steering target from the latest sensor sample. */
  private rawSteer = 0;
  /** Low-pass filtered steering actually reported to the engine. */
  private smoothedSteer = 0;

  private screenAngle = 0;
  private status: MotionStatus = 'off';

  /** Full-lock tilt in degrees; beyond this the steering saturates. */
  private readonly maxTiltDeg = 32;
  /** Ignore tiny tilts so the bike tracks straight while held steady. */
  private readonly deadzone = 0.06;

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
    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
      this.status = 'unsupported';
      return false;
    }

    this.enabling = true;
    try {
      const ctor = window.DeviceOrientationEvent as OrientationPermissionCtor;
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
      this.calibrated = false;
      this.rawSteer = 0;
      this.smoothedSteer = 0;
      this.screenAngle = this.readScreenAngle();

      window.addEventListener('deviceorientation', this.handleOrientation, true);
      window.addEventListener('orientationchange', this.handleOrientationChange);
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
      window.screen?.orientation?.removeEventListener?.('change', this.handleOrientationChange);
      this.listening = false;
    }
    this.rawSteer = 0;
    this.smoothedSteer = 0;
    this.calibrated = false;
    this.status = 'off';
  }

  /** Drops the captured neutral so the next sample becomes the new "straight ahead". */
  public recalibrate(): void {
    if (!this.enabled) return;
    this.calibrated = false;
    this.rawSteer = 0;
    this.smoothedSteer = 0;
  }

  /** Smoothed steering in [-1, 1] (+1 left, -1 right). Call once per frame. */
  public getSteer(dt: number): number {
    if (!this.enabled || this.status !== 'active') return 0;
    const k = 1 - Math.exp(-12 * Math.min(Math.max(dt, 0.001), 0.05));
    this.smoothedSteer += (this.rawSteer - this.smoothedSteer) * k;
    if (Math.abs(this.smoothedSteer) < 0.001) this.smoothedSteer = 0;
    return this.smoothedSteer;
  }

  private handleOrientation = (event: DeviceOrientationEvent): void => {
    if (event.beta === null || event.gamma === null) return;

    if (!this.receivedOrientation) {
      this.receivedOrientation = true;
      this.status = 'active';
    }

    const tilt = this.readTilt(event.beta, event.gamma);
    if (!this.calibrated) {
      this.baseTilt = tilt;
      this.calibrated = true;
    }

    const delta = tilt - this.baseTilt;
    // readTilt() grows when the device is rolled to the right, but the engine's
    // positive steer is a LEFT turn, so invert here.
    const steer = clamp(delta / this.maxTiltDeg, -1, 1);
    this.rawSteer = -this.applyDeadzone(steer);
  };

  private handleOrientationChange = (): void => {
    this.screenAngle = this.readScreenAngle();
    this.calibrated = false;
  };

  private applyDeadzone(value: number): number {
    const magnitude = Math.abs(value);
    if (magnitude < this.deadzone) return 0;
    return Math.sign(value) * ((magnitude - this.deadzone) / (1 - this.deadzone));
  }

  private readScreenAngle(): number {
    const angle =
      (typeof window !== 'undefined' && window.screen?.orientation?.angle) ||
      (typeof window !== 'undefined' ? (window as unknown as { orientation?: number }).orientation : 0) ||
      0;
    return ((angle % 360) + 360) % 360;
  }

  /** Returns the current roll angle in degrees, growing as the device rolls right. */
  private readTilt(beta: number, gamma: number): number {
    switch (this.screenAngle) {
      case 90:
        return beta;
      case 270:
        return -beta;
      case 180:
        return -gamma;
      default:
        return gamma;
    }
  }
}