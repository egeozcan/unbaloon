import {
  RAIN_LIFETIME,
  RAIN_COOLDOWN,
  RAIN_SIZE_RATIO,
  RAIN_MIN_SIZE,
  RAIN_FADE_DURATION,
  RAIN_TOP_RATIO,
  RAIN_BODY_HALF_RATIO,
  RAIN_WANDER_SPEED,
  RAIN_RETARGET_MIN,
  RAIN_RETARGET_MAX,
  RAIN_EDGE_MARGIN,
  RAIN_BOB_AMPLITUDE,
  RAIN_BOB_FREQUENCY,
  RAIN_BAND_WIDTH_RATIO,
} from './constants';
import { vehicleButtonRadius, effectButtonX, effectButtonY } from './buttonLayout';

export type RainCloudState = 'idle' | 'active' | 'cooldown';

// The shape the rain cloud needs from a balloon. Balloon satisfies this
// structurally, so the manager stays decoupled and unit-testable with fakes. The
// cloud never moves or claims a balloon — it only reads its position and calls
// `applyRainSlow()` on the ones under its downpour, so everything here is read-only
// except that one effect. `loaded` is read to skip balloons the tractor is holding.
export interface RainTarget {
  readonly x: number;
  readonly y: number;
  readonly loaded: boolean;
  applyRainSlow(): void;
}

export class RainCloudManager {
  state: RainCloudState = 'idle';

  // Cloud centre x (wanders) and the drift target it is easing toward.
  x: number = 0;
  animTime: number = 0; // drives the bob and the falling-drop animation (read by the renderer)

  private targetX: number = 0;
  private retargetTimer: number = 0;
  private retargetInterval: number = RAIN_RETARGET_MIN;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    // Keep an active cloud on-screen after a resize / rotation.
    if (this.state === 'active') {
      this.x = this.clampX(this.x);
      this.targetX = this.clampX(this.targetX);
    }
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(RAIN_MIN_SIZE, this.screenWidth * RAIN_SIZE_RATIO);
  }

  // Cloud centre y — fixed near the top with a slow bob so it feels alive.
  get y(): number {
    const base = this.screenHeight * RAIN_TOP_RATIO;
    return base + Math.sin(this.animTime * RAIN_BOB_FREQUENCY * Math.PI * 2) * RAIN_BOB_AMPLITUDE;
  }

  // Underside of the cloud, where the rain starts falling.
  get cloudBaseY(): number {
    return this.y + this.size * 0.18;
  }

  // The downpour fills the screen below the cloud (renderer clips drops to here).
  get fallBottomY(): number {
    return this.screenHeight;
  }

  // Half-width of the rain column; balloons within ±this of the cloud x get rained on.
  get rainHalfWidth(): number {
    return (this.size * RAIN_BAND_WIDTH_RATIO) / 2;
  }

  // The cloud centre stays a full body half-extent (not just size/2 — the puffy
  // lobes overhang to ~0.57·size) from each wall, so the whole drawn cloud stays
  // on-screen even when it drifts to a band edge.
  private get bandLeft(): number {
    return RAIN_EDGE_MARGIN + this.size * RAIN_BODY_HALF_RATIO;
  }

  private get bandRight(): number {
    return this.screenWidth - RAIN_EDGE_MARGIN - this.size * RAIN_BODY_HALF_RATIO;
  }

  private clampX(x: number): number {
    const left = this.bandLeft;
    const right = this.bandRight;
    if (right <= left) return (left + right) / 2; // cloud wider than the viewport — centre it
    return Math.max(left, Math.min(right, x));
  }

  // First effect button — top of the right-edge column (see buttonLayout.ts).
  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return effectButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return effectButtonY(0, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = RAIN_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / RAIN_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / RAIN_COOLDOWN);
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  get isAvailable(): boolean {
    return this.state === 'idle';
  }

  // Gentle 0 → 1 oscillation for the idle button's invite-to-tap pulse.
  get buttonPulse(): number {
    return 0.5 + 0.5 * Math.sin(this.animTime * Math.PI * 2 * 0.8);
  }

  // ── Spawn button ─────────────────────────────────────────────────────────────

  buttonHitTest(px: number, py: number): boolean {
    const dx = px - this.buttonX;
    const dy = py - this.buttonY;
    const r = this.buttonRadius * 1.25; // generous touch target
    return dx * dx + dy * dy <= r * r;
  }

  // Returns true if the tap summoned a rain cloud.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.x = this.clampX(this.screenWidth / 2); // drift in from the centre
    this.pickTarget();
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  // Wanders the cloud and slows any balloon under the downpour. The cloud claims
  // nothing, so there is no callback: it just calls `applyRainSlow()` on targets.
  update<T extends RainTarget>(dt: number, balloons: T[]): void {
    this.animTime += dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= RAIN_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    this.wander(dt);
    this.rainOn(balloons);

    if (this.lifeTimer >= RAIN_LIFETIME) {
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  // Drift toward the current target; pick a fresh one once reached or the dwell
  // timer elapses. Random targets at random intervals read as an organic wander
  // rather than the tractor's predictable wall-to-wall sweep.
  private wander(dt: number): void {
    this.retargetTimer += dt;
    if (this.retargetTimer >= this.retargetInterval || Math.abs(this.targetX - this.x) < 2) {
      this.pickTarget();
    }
    const step = RAIN_WANDER_SPEED * dt;
    if (Math.abs(this.targetX - this.x) <= step) {
      this.x = this.targetX;
    } else {
      this.x += Math.sign(this.targetX - this.x) * step;
    }
    this.x = this.clampX(this.x);
  }

  private pickTarget(): void {
    this.retargetTimer = 0;
    this.retargetInterval = RAIN_RETARGET_MIN + Math.random() * (RAIN_RETARGET_MAX - RAIN_RETARGET_MIN);
    const left = this.bandLeft;
    const right = this.bandRight;
    if (right <= left) {
      this.targetX = (left + right) / 2;
      return;
    }
    const span = right - left;
    let t = left + Math.random() * span;
    // Keep the cloud genuinely roaming: if the fresh target landed too close to
    // where it already is, send it off toward the farther side instead of dithering.
    if (Math.abs(t - this.x) < span * 0.25) {
      const mid = (left + right) / 2;
      t = this.x < mid ? right - Math.random() * span * 0.4 : left + Math.random() * span * 0.4;
    }
    this.targetX = this.clampX(t);
  }

  // Slow every free balloon sitting in the column of rain below the cloud. The
  // gate uses the cloud base (where the visible downpour starts), so the slowed
  // zone lines up with the drawn rain rather than reaching up into the cloud body.
  private rainOn<T extends RainTarget>(balloons: T[]): void {
    const cx = this.x;
    const half = this.rainHalfWidth;
    const rainTop = this.cloudBaseY;
    for (const b of balloons) {
      if (b.loaded) continue;          // the tractor owns loaded balloons
      if (b.y < rainTop) continue;     // rain only falls on balloons below the cloud base
      if (b.x < cx - half || b.x > cx + half) continue;
      b.applyRainSlow();
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the cloud without starting a cooldown (used when the finale begins).
  // Balloons it was slowing recover on their own — nothing to release.
  clear(): void {
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
  }

  reset(): void {
    this.clear();
    this.animTime = 0;
  }
}
