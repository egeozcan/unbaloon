import {
  TRACTOR_LIFETIME,
  TRACTOR_COOLDOWN,
  TRACTOR_SIZE_RATIO,
  TRACTOR_MIN_SIZE,
  TRACTOR_FADE_DURATION,
  TRACTOR_SPEED,
  TRACTOR_WHEEL_SPIN,
  TRACTOR_EDGE_MARGIN,
  TRACTOR_TRAILER_GAP_RATIO,
  TRACTOR_TRAILER_LENGTH_RATIO,
  TRACTOR_CAPACITY,
  TRACTOR_PROCESS_INTERVAL,
} from './constants';
import { vehicleButtonRadius, vehicleButtonX, vehicleButtonY } from './buttonLayout';

export type TractorState = 'idle' | 'active' | 'cooldown';

// The shape the tractor needs from a balloon. Balloon satisfies this
// structurally, so the manager stays decoupled and unit-testable with fakes.
// The tractor *carries* its targets, so it needs the writable position fields
// plus the `loaded` flag it sets to claim a balloon (which freezes its drift and
// excludes it from every other interaction). `dragged`/`isDraggable` are read
// only — to skip balloons being held elsewhere and the non-draggable specials.
export interface LoadTarget {
  x: number;
  y: number;
  baseX: number;
  radiusX: number;
  radiusY: number;
  loaded: boolean;
  readonly dragged: boolean;
  readonly isDraggable: boolean;
  hitTest(px: number, py: number): boolean;
}

interface LoadedEntry {
  balloon: LoadTarget;
  timer: number; // counts up to TRACTOR_PROCESS_INTERVAL, then a layer is shed
}

// ── Sprite layout (fractions of body length `size`, drawn nose-to-the-right) ──
// The tractor always faces right and shuttles by reversing its velocity, towing
// the trailer on its left. (Mirroring the whole rig at a wall would fling the
// long trailer off-screen, so the body never flips — moving left simply reads as
// reversing.) These two also anchor the trailer the renderer hangs off the back.
const FRONT_LOCAL = 0.48;     // front extent ahead of body centre (front wheel edge)
const HITCH_LOCAL = -0.46;    // rear hitch point behind body centre
const BED_SURFACE_LOCAL = -0.06; // trailer bed top, relative to body centre y
const GROUND_LOCAL = 0.44;    // body centre sits this far above the screen bottom
const REST_LIFT = 0.85;       // a loaded balloon's centre rides this×radiusY above the bed

export class TractorManager {
  state: TractorState = 'idle';

  // Body centre x (moves) and travel direction (+1 right, -1 left). The body
  // always faces right; `dir` is just the velocity sign (and spins the wheels).
  x: number = 0;
  dir: number = 1;
  wheelPhase: number = 0; // animates the rolling wheels

  private animTime: number = 0;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;
  private loaded: LoadedEntry[] = [];

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    // Keep an active tractor's whole rig on-screen after a resize / rotation.
    if (this.state === 'active') this.clampToBand();
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(TRACTOR_MIN_SIZE, this.screenWidth * TRACTOR_SIZE_RATIO);
  }

  // Body centre y — fixed near the bottom so the wheels ride along the floor.
  get y(): number {
    return this.screenHeight - this.size * GROUND_LOCAL;
  }

  private get trailerLength(): number {
    return this.size * TRACTOR_TRAILER_LENGTH_RATIO;
  }

  // Half the trailer bed's width (its load footprint reaches this far each side).
  get bedHalfWidth(): number {
    return this.trailerLength / 2;
  }

  // World-x of the trailer bed centre (always behind the rightward-facing body).
  get trailerCenterX(): number {
    const gap = this.size * TRACTOR_TRAILER_GAP_RATIO;
    return this.x + HITCH_LOCAL * this.size - gap - this.trailerLength / 2;
  }

  // World-y of the trailer bed's top surface (loaded balloons rest on it).
  get bedSurfaceY(): number {
    return this.y + BED_SURFACE_LOCAL * this.size;
  }

  get loadedCount(): number {
    return this.loaded.length;
  }

  // Distance the body centre may travel: trailer tail to the left wall, nose to
  // the right wall. The body never reaches the left wall (the trailer does).
  private get bandLeft(): number {
    const gap = this.size * TRACTOR_TRAILER_GAP_RATIO;
    return TRACTOR_EDGE_MARGIN + (-HITCH_LOCAL * this.size) + gap + this.trailerLength;
  }

  private get bandRight(): number {
    return this.screenWidth - TRACTOR_EDGE_MARGIN - FRONT_LOCAL * this.size;
  }

  // Resting centre-y for a balloon of the given radius sitting on the bed.
  private restY(radiusY: number): number {
    return this.bedSurfaceY - radiusY * REST_LIFT;
  }

  // Fourth button in the shared left-edge column (see buttonLayout.ts).
  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return vehicleButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return vehicleButtonY(3, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = TRACTOR_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / TRACTOR_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / TRACTOR_COOLDOWN);
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
    const r = this.buttonRadius * 1.25; // generous touch target
    return dx * dx + dy * dy <= r * r;
  }

  // Returns true if the tap spawned a tractor.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.loaded = [];
    this.dir = 1;
    // Roll on from the left, far enough in that the whole trailer is on-screen.
    this.x = this.bandLeft;
    this.clampToBand();
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  // `onProcess` taps a loaded balloon (sheds one layer / pops it); `onLoad` fires
  // once whenever a free-floating balloon is auto-caught by the bed.
  update<T extends LoadTarget>(
    dt: number,
    balloons: T[],
    onProcess: (target: T) => void,
    onLoad?: (target: T) => void,
  ): void {
    this.animTime += dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= TRACTOR_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    this.wheelPhase += this.dir * TRACTOR_WHEEL_SPIN * dt;

    this.drive(dt);
    this.dropPoppedCargo();
    this.catchTouchingBalloons(balloons, onLoad);
    this.carryCargo();
    this.processCargo(dt, onProcess);

    if (this.lifeTimer >= TRACTOR_LIFETIME) {
      this.releaseAll();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  // Trundle along the floor, reversing when an end of the rig reaches a wall.
  private drive(dt: number): void {
    this.x += this.dir * TRACTOR_SPEED * dt;
    const left = this.bandLeft;
    const right = this.bandRight;
    if (right <= left) {
      // Rig wider than the viewport — park it centred rather than jitter.
      this.x = (left + right) / 2;
      return;
    }
    if (this.x >= right) {
      this.x = right;
      this.dir = -1;
    } else if (this.x <= left) {
      this.x = left;
      this.dir = 1;
    }
  }

  // Drop any cargo that has popped (hitTest fails once it leaves floating), so
  // its pop animation plays out freely and a bed slot frees up.
  private dropPoppedCargo(): void {
    const kept: LoadedEntry[] = [];
    for (const e of this.loaded) {
      if (e.balloon.hitTest(e.balloon.x, e.balloon.y)) {
        kept.push(e);
      } else {
        e.balloon.loaded = false;
      }
    }
    this.loaded = kept;
  }

  // Scoop up free-floating balloons whose body sits over the bed, up to capacity.
  private catchTouchingBalloons<T extends LoadTarget>(balloons: T[], onLoad?: (t: T) => void): void {
    if (this.loaded.length >= TRACTOR_CAPACITY) return;
    const cx = this.trailerCenterX;
    const half = this.bedHalfWidth;
    for (const b of balloons) {
      if (this.loaded.length >= TRACTOR_CAPACITY) break;
      if (b.loaded || b.dragged || !b.isDraggable) continue;
      if (!b.hitTest(b.x, b.y)) continue; // only catch live, poppable balloons
      if (b.x < cx - half || b.x > cx + half) continue;
      const rest = this.restY(b.radiusY);
      if (b.y < rest - b.radiusY || b.y > rest + b.radiusY) continue;
      this.load(b);
      onLoad?.(b);
    }
  }

  // Hold every loaded balloon in its slot on the bed, riding along with the rig.
  private carryCargo(): void {
    const n = this.loaded.length;
    const cx = this.trailerCenterX;
    const half = this.bedHalfWidth;
    for (let i = 0; i < n; i++) {
      const b = this.loaded[i].balloon;
      const innerLeft = cx - half + b.radiusX;
      const innerRight = cx + half - b.radiusX;
      let slotX: number;
      if (innerRight <= innerLeft) {
        slotX = cx; // balloon wider than the bed — just centre it
      } else {
        const frac = n === 1 ? 0.5 : i / (n - 1);
        slotX = innerLeft + frac * (innerRight - innerLeft);
      }
      b.x = slotX;
      b.baseX = slotX;
      b.y = this.restY(b.radiusY);
    }
  }

  // Tick each cargo balloon's timer; shed a layer when it reaches the interval.
  private processCargo<T extends LoadTarget>(dt: number, onProcess: (t: T) => void): void {
    for (const e of this.loaded) {
      e.timer += dt;
      if (e.timer >= TRACTOR_PROCESS_INTERVAL) {
        e.timer -= TRACTOR_PROCESS_INTERVAL;
        onProcess(e.balloon as T);
      }
    }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  // Try to load a balloon the player dropped onto the trailer. Returns true if it
  // was accepted (the caller can then play a sound). Generous footprint so a drop
  // anywhere over the bed counts.
  tryDrop(b: LoadTarget): boolean {
    if (this.state !== 'active') return false;
    if (this.loaded.length >= TRACTOR_CAPACITY) return false;
    if (b.loaded || !b.isDraggable) return false;
    if (!b.hitTest(b.x, b.y)) return false;
    const cx = this.trailerCenterX;
    const half = this.bedHalfWidth;
    if (b.x < cx - half - b.radiusX || b.x > cx + half + b.radiusX) return false;
    if (b.y < this.bedSurfaceY - b.radiusY * 2.5 || b.y > this.screenHeight) return false;
    this.load(b);
    return true;
  }

  private load(b: LoadTarget): void {
    b.loaded = true;
    this.loaded.push({ balloon: b, timer: 0 });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private releaseAll(): void {
    for (const e of this.loaded) e.balloon.loaded = false;
    this.loaded = [];
  }

  private clampToBand(): void {
    const left = this.bandLeft;
    const right = this.bandRight;
    if (right <= left) {
      this.x = (left + right) / 2;
      return;
    }
    this.x = Math.max(left, Math.min(right, this.x));
  }

  // Remove the tractor without starting a cooldown (used when the finale begins).
  clear(): void {
    this.releaseAll();
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.dir = 1;
  }

  reset(): void {
    this.clear();
    this.animTime = 0;
    this.wheelPhase = 0;
  }
}
