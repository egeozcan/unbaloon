import {
  HELICOPTER_LIFETIME,
  HELICOPTER_COOLDOWN,
  HELICOPTER_SIZE_RATIO,
  HELICOPTER_MIN_SIZE,
  HELICOPTER_FADE_DURATION,
  HELICOPTER_BOB_AMPLITUDE,
  HELICOPTER_BOB_FREQUENCY,
  HELICOPTER_ROTOR_SPEED,
  HELICOPTER_GRAB_RADIUS_RATIO,
  DART_FIRE_INTERVAL,
  DART_SPEED,
  DART_LIFETIME,
  DART_MUZZLE_OFFSET_RATIO,
  DART_RANGE_RATIO,
  DART_RANGE_MIN,
  DART_RANGE_MAX,
  DART_SPREAD,
} from './constants';
import { vehicleButtonRadius, vehicleButtonX, vehicleButtonY } from './buttonLayout';

export type HeliState = 'idle' | 'active' | 'cooldown';

export interface Dart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  traveled: number; // distance covered so far (for the range cap)
}

// Minimal shape the helicopter needs from a balloon. Balloon satisfies this
// structurally, so the manager stays decoupled and unit-testable with fakes.
export interface DartTarget {
  x: number;
  y: number;
  hitTest(px: number, py: number): boolean;
}

export class HelicopterManager {
  state: HeliState = 'idle';

  // Hover anchor (where the helicopter sits / was last dragged to).
  x: number = 0;
  y: number = 0;

  rotorAngle: number = 0;
  darts: Dart[] = [];

  private animTime: number = 0;
  private bobOffset: number = 0;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;
  private fireTimer: number = 0;
  private grabbedBy: number | null = null;
  private grabDX: number = 0; // pointer→body offset captured at grab time
  private grabDY: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    // Keep an active helicopter on-screen after a resize / rotation.
    if (this.state === 'active') {
      const half = this.size * 0.5;
      this.x = Math.max(half, Math.min(this.screenWidth - half, this.x));
      this.y = Math.max(half, Math.min(this.screenHeight - half, this.y));
    }
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(HELICOPTER_MIN_SIZE, this.screenWidth * HELICOPTER_SIZE_RATIO);
  }

  // How far the helicopter can target and how far a dart travels before fizzling.
  get dartRange(): number {
    const r = Math.min(this.screenWidth, this.screenHeight) * DART_RANGE_RATIO;
    return Math.max(DART_RANGE_MIN, Math.min(DART_RANGE_MAX, r));
  }

  // First button in the shared left-edge column (see buttonLayout.ts).
  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return vehicleButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return vehicleButtonY(0, this.screenWidth, this.screenHeight);
  }

  // Vertical position used for both drawing and firing (includes hover bob).
  get displayY(): number {
    return this.y + this.bobOffset;
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = HELICOPTER_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / HELICOPTER_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / HELICOPTER_COOLDOWN);
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

  // ── Spawn button ───────────────────────────────────────────────────────────

  buttonHitTest(px: number, py: number): boolean {
    const dx = px - this.buttonX;
    const dy = py - this.buttonY;
    // Generous touch target: a little larger than the visible radius.
    const r = this.buttonRadius * 1.25;
    return dx * dx + dy * dy <= r * r;
  }

  // Returns true if the tap spawned a helicopter.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.fireTimer = DART_FIRE_INTERVAL; // ready to fire as soon as a target exists
    this.darts = [];
    this.grabbedBy = null;
    // Spawn at the button, nudged on-screen so the rotor isn't clipped.
    this.x = Math.max(this.size * 0.5 + 4, this.buttonX);
    this.y = this.buttonY;
    this.bobOffset = 0;
  }

  // ── Dragging ───────────────────────────────────────────────────────────────

  tryGrab(id: number, px: number, py: number): boolean {
    if (this.state !== 'active') return false;
    const dx = px - this.x;
    const dy = py - this.displayY;
    const r = this.size * HELICOPTER_GRAB_RADIUS_RATIO;
    if (dx * dx + dy * dy > r * r) return false;
    this.grabbedBy = id;
    // Remember where on the body the grab landed so it doesn't snap to the pointer.
    this.grabDX = this.x - px;
    this.grabDY = this.displayY - py;
    return true;
  }

  drag(id: number, px: number, py: number): boolean {
    if (this.grabbedBy !== id) return false;
    // Preserve the grab offset (and cancel the bob) so the body tracks the pointer
    // smoothly, then clamp so it stays on screen.
    const half = this.size * 0.5;
    this.x = Math.max(half, Math.min(this.screenWidth - half, px + this.grabDX));
    this.y = Math.max(half, Math.min(this.screenHeight - half, py + this.grabDY - this.bobOffset));
    return true;
  }

  release(id: number): boolean {
    if (this.grabbedBy !== id) return false;
    this.grabbedBy = null;
    return true;
  }

  releaseAll(): void {
    this.grabbedBy = null;
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update<T extends DartTarget>(
    dt: number,
    targets: T[],
    onHit: (target: T) => void,
    onFire?: () => void,
  ): void {
    this.animTime += dt;
    this.rotorAngle += HELICOPTER_ROTOR_SPEED * dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= HELICOPTER_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    this.bobOffset = Math.sin(this.animTime * HELICOPTER_BOB_FREQUENCY * Math.PI * 2) * HELICOPTER_BOB_AMPLITUDE;

    // Fire at the nearest poppable target that is within range.
    this.fireTimer += dt;
    if (this.fireTimer >= DART_FIRE_INTERVAL) {
      const target = this.nearestTarget(targets);
      if (target && this.isWithinRange(target)) {
        this.fireDartAt(target.x, target.y);
        this.fireTimer = 0;
        onFire?.();
      } else {
        this.fireTimer = DART_FIRE_INTERVAL; // stay primed, but don't accumulate
      }
    }

    this.updateDarts(dt, targets, onHit);

    if (this.lifeTimer >= HELICOPTER_LIFETIME) {
      this.state = 'cooldown';
      this.cooldownTimer = 0;
      this.darts = [];
      this.grabbedBy = null;
    }
  }

  private nearestTarget<T extends DartTarget>(targets: T[]): T | null {
    const ox = this.x;
    const oy = this.displayY;
    let best: T | null = null;
    let bestDist = Infinity;
    for (const t of targets) {
      // hitTest at the target's own centre is true only while it's poppable.
      if (!t.hitTest(t.x, t.y)) continue;
      const dx = t.x - ox;
      const dy = t.y - oy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private isWithinRange(t: DartTarget): boolean {
    const dx = t.x - this.x;
    const dy = t.y - this.displayY;
    const range = this.dartRange;
    return dx * dx + dy * dy <= range * range;
  }

  private fireDartAt(tx: number, ty: number): void {
    const ox = this.x;
    const oy = this.displayY;
    // Aim at the target, but with a random spread so it isn't pixel-perfect.
    const baseAngle = Math.atan2(ty - oy, tx - ox);
    const angle = baseAngle + (Math.random() - 0.5) * 2 * DART_SPREAD;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const muzzle = this.size * DART_MUZZLE_OFFSET_RATIO;
    this.darts.push({
      x: ox + ux * muzzle,
      y: oy + uy * muzzle,
      vx: ux * DART_SPEED,
      vy: uy * DART_SPEED,
      age: 0,
      traveled: 0,
    });
  }

  private updateDarts<T extends DartTarget>(dt: number, targets: T[], onHit: (target: T) => void): void {
    const margin = 24;
    const range = this.dartRange;
    const next: Dart[] = [];
    for (const dart of this.darts) {
      const dx = dart.vx * dt;
      const dy = dart.vy * dt;
      dart.x += dx;
      dart.y += dy;
      dart.age += dt;
      dart.traveled += Math.hypot(dx, dy);

      // Cull darts that have reached their range, timed out, or left the screen.
      if (
        dart.traveled >= range ||
        dart.age >= DART_LIFETIME ||
        dart.x < -margin ||
        dart.x > this.screenWidth + margin ||
        dart.y < -margin ||
        dart.y > this.screenHeight + margin
      ) {
        continue;
      }

      // Hit test against poppable targets.
      let hit = false;
      for (const t of targets) {
        if (t.hitTest(dart.x, dart.y)) {
          onHit(t);
          hit = true;
          break;
        }
      }
      if (!hit) next.push(dart);
    }
    this.darts = next;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the helicopter without starting a cooldown (used when the finale begins).
  clear(): void {
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.fireTimer = 0;
    this.darts = [];
    this.grabbedBy = null;
    this.bobOffset = 0;
  }

  reset(): void {
    this.clear();
    this.animTime = 0;
    this.rotorAngle = 0;
  }
}
