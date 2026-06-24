import {
  BULLDOZER_LIFETIME,
  BULLDOZER_COOLDOWN,
  BULLDOZER_SIZE_RATIO,
  BULLDOZER_MIN_SIZE,
  BULLDOZER_FADE_DURATION,
  BULLDOZER_SPEED,
  BULLDOZER_PUSH_SPEED,
  BULLDOZER_TURN_RATE,
  BULLDOZER_TRACK_SPEED,
  BULLDOZER_BLADE_REACH_RATIO,
  BULLDOZER_BLADE_HALF_RATIO,
  BULLDOZER_ENGAGE_RATIO,
  BULLDOZER_PIN_SLACK,
  BULLDOZER_CRUSH_INTERVAL,
} from './constants';
import { vehicleButtonRadius, vehicleButtonX, vehicleButtonY } from './buttonLayout';

export type BulldozerState = 'idle' | 'active' | 'cooldown';

// The shape the bulldozer needs from a balloon. Balloon satisfies this
// structurally, so the manager stays decoupled and unit-testable with fakes.
// Unlike the dart/missile targets the bulldozer *moves* its target, so it needs
// the writable position/size fields plus the `dragged` flag it sets to freeze a
// balloon's drift while shoving it (the same flag the game uses for finger drags).
export interface PushTarget {
  x: number;
  y: number;
  baseX: number;
  radiusX: number;
  radiusY: number;
  dragged: boolean;
  hitTest(px: number, py: number): boolean;
}

// Smallest signed angle to rotate `from` toward `to`, in (-π, π].
function angleDiff(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `current` toward `target` by at most `maxStep` radians.
function steer(current: number, target: number, maxStep: number): number {
  const d = angleDiff(current, target);
  if (d > maxStep) return current + maxStep;
  if (d < -maxStep) return current - maxStep;
  return target;
}

export class BulldozerManager {
  state: BulldozerState = 'idle';

  // Position (body centre) and facing heading (radians; 0 = pointing right).
  x: number = 0;
  y: number = 0;
  heading: number = 0;

  trackPhase: number = 0; // animates the rolling tracks / wheels
  // True on the frame a crush bite lands — the renderer judders the blade.
  crushing: boolean = false;

  private animTime: number = 0;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;

  // Active sub-behaviour: line up behind a balloon ('seek'), then sweep its whole
  // lane into the wall and crush the row ('push').
  private phase: 'seek' | 'push' = 'seek';
  // Every balloon currently caught in the blade's lane (frozen and being shoved).
  private caught: PushTarget[] = [];
  private pushDir: number = 1; // locked push direction while pushing (-1 left, +1 right)
  private sweepY: number = 0;  // locked lane centre for the current push
  private crushTimer: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    // Keep an active bulldozer on-screen after a resize / rotation.
    if (this.state === 'active') this.clampToScreen();
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(BULLDOZER_MIN_SIZE, this.screenWidth * BULLDOZER_SIZE_RATIO);
  }

  // How far in front of the body centre the blade reaches.
  get bladeReach(): number {
    return this.size * BULLDOZER_BLADE_REACH_RATIO;
  }

  // Third button in the shared left-edge column (see buttonLayout.ts).
  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return vehicleButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return vehicleButtonY(2, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = BULLDOZER_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / BULLDOZER_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / BULLDOZER_COOLDOWN);
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

  // Returns true if the tap spawned a bulldozer.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.phase = 'seek';
    this.caught = [];
    this.crushTimer = 0;
    this.crushing = false;
    // Roll out from the button, facing into the play area. The button is the
    // lowest of the three, so clamp in case it sits near the bottom edge.
    this.x = Math.max(this.size * 0.5, this.buttonX);
    this.y = this.buttonY;
    this.heading = 0;
    this.clampToScreen();
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update<T extends PushTarget>(
    dt: number,
    targets: T[],
    onCrush: (target: T) => void,
  ): void {
    this.animTime += dt;
    this.trackPhase += BULLDOZER_TRACK_SPEED * dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= BULLDOZER_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    this.crushing = false;

    if (this.phase === 'push') this.updatePush(dt, targets, onCrush);
    else this.updateSeek(dt, targets);

    if (this.lifeTimer >= BULLDOZER_LIFETIME) {
      this.releaseAll();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
      this.phase = 'seek';
    }
  }

  // Pick the nearest poppable balloon, drive in behind it (on the side away from
  // the nearer wall), then commit to a push once we're tucked in close.
  private updateSeek<T extends PushTarget>(dt: number, targets: T[]): void {
    const target = this.nearestTarget(targets);
    if (!target) {
      // Nothing to crush — ease back to facing right and idle in place.
      this.heading = steer(this.heading, 0, BULLDOZER_TURN_RATE * dt);
      return;
    }

    const dir = target.x < this.screenWidth / 2 ? -1 : 1; // nearer side wall
    const behindX = target.x - dir * this.standoff(target);
    const behindY = target.y;

    const dx = behindX - this.x;
    const dy = behindY - this.y;
    const dist = Math.hypot(dx, dy);

    this.heading = steer(this.heading, Math.atan2(dy, dx), BULLDOZER_TURN_RATE * dt);
    this.x += Math.cos(this.heading) * BULLDOZER_SPEED * dt;
    this.y += Math.sin(this.heading) * BULLDOZER_SPEED * dt;
    this.clampToScreen();

    // Tucked in behind the balloon → commit to a sweep of its whole lane toward
    // the wall. Freezing the lead balloon stops its drift; the lane is captured
    // continuously during the push. Heading squares up to the wall.
    if (dist <= this.size * BULLDOZER_ENGAGE_RATIO) {
      this.phase = 'push';
      this.pushDir = dir;
      this.sweepY = target.y;
      this.crushTimer = 0;
      target.dragged = true;
      this.caught = [target];
    }
  }

  // Sweep the whole lane: scoop every balloon in front of the blade, herd them
  // into the wall, and crush the pinned row together in rhythmic bites.
  private updatePush<T extends PushTarget>(dt: number, targets: T[], onCrush: (target: T) => void): void {
    // Keep only still-poppable balloons, re-asserting their freeze each frame so
    // an external clear (e.g. the player grabbing and releasing one mid-shove)
    // self-heals instead of letting it drift out from under the blade.
    const stillCaught: PushTarget[] = [];
    for (const b of this.caught) {
      if (b.hitTest(b.x, b.y)) {
        b.dragged = true;
        stillCaught.push(b);
      } else {
        b.dragged = false;
      }
    }
    this.caught = stillCaught;

    // Scoop any other poppable balloon whose body overlaps the blade's lane and
    // sits ahead of the blade (between it and the wall).
    const bladeFront = this.x + this.pushDir * this.bladeReach;
    for (const b of targets) {
      if (this.caught.includes(b)) continue;
      if (!b.hitTest(b.x, b.y)) continue;
      if (!this.inLane(b)) continue;
      if (!this.aheadOfBlade(b, bladeFront)) continue;
      b.dragged = true;
      this.caught.push(b);
    }

    // Lane swept clear → look for the next one.
    if (this.caught.length === 0) {
      this.phase = 'seek';
      return;
    }

    // Drive in behind the rearmost caught balloon (the one nearest the dozer),
    // holding the lane at a steady height and facing the wall.
    const rear = this.rearmost();
    const behindX = rear.x - this.pushDir * this.standoff(rear);
    const dx = behindX - this.x;
    const dy = this.sweepY - this.y;
    const dist = Math.hypot(dx, dy);

    this.heading = steer(this.heading, this.pushDir < 0 ? Math.PI : 0, BULLDOZER_TURN_RATE * dt);
    const follow = Math.min(1, (BULLDOZER_SPEED * dt) / (dist || 1));
    this.x += dx * follow;
    this.y += dy * follow;
    this.clampToScreen();

    // Once the blade is in contact, shove the whole caught row toward the wall;
    // each balloon pins where it meets the wall, the rest stacking up in a column.
    if (dist <= this.size * 0.7) {
      for (const b of this.caught) {
        b.x += this.pushDir * BULLDOZER_PUSH_SPEED * dt;
        b.x = Math.max(b.radiusX, Math.min(this.screenWidth - b.radiusX, b.x));
        b.baseX = b.x;
      }
    }

    // Crush every pinned balloon together, in rhythmic bites.
    const pinned = this.caught.filter((b) => this.isPinned(b));
    if (pinned.length > 0) {
      this.crushTimer += dt;
      if (this.crushTimer >= BULLDOZER_CRUSH_INTERVAL) {
        this.crushTimer = 0;
        this.crushing = true;
        for (const b of pinned) onCrush(b as T);
      }
    } else {
      this.crushTimer = 0;
    }
  }

  // Distance from a balloon's centre at which the dozer lines up behind it, so
  // the blade front meets the balloon's near edge.
  private standoff(t: PushTarget): number {
    return t.radiusX + this.bladeReach;
  }

  // A balloon whose body overlaps the blade's vertical capture lane.
  private inLane(t: PushTarget): boolean {
    return Math.abs(t.y - this.y) <= this.size * BULLDOZER_BLADE_HALF_RATIO + t.radiusY;
  }

  // A balloon at or beyond the blade front, on the wall side (so the blade can
  // push it). pushDir > 0 sweeps right; < 0 sweeps left.
  private aheadOfBlade(t: PushTarget, bladeFront: number): boolean {
    return this.pushDir > 0 ? t.x >= bladeFront - t.radiusX : t.x <= bladeFront + t.radiusX;
  }

  // The caught balloon nearest the dozer (least advanced toward the wall); the
  // blade tucks in behind it.
  private rearmost(): PushTarget {
    let best = this.caught[0];
    for (const b of this.caught) {
      if (this.pushDir > 0 ? b.x < best.x : b.x > best.x) best = b;
    }
    return best;
  }

  private isPinned(t: PushTarget): boolean {
    if (this.pushDir < 0) return t.x <= t.radiusX + BULLDOZER_PIN_SLACK;
    return t.x >= this.screenWidth - t.radiusX - BULLDOZER_PIN_SLACK;
  }

  private nearestTarget<T extends PushTarget>(targets: T[]): T | null {
    let best: T | null = null;
    let bestDist = Infinity;
    for (const t of targets) {
      // hitTest at the target's own centre is true only while it's poppable.
      if (!t.hitTest(t.x, t.y)) continue;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private clampToScreen(): void {
    const half = this.size * 0.5;
    this.x = Math.max(half, Math.min(this.screenWidth - half, this.x));
    this.y = Math.max(half, Math.min(this.screenHeight - half, this.y));
  }

  // Release every caught balloon (unfreeze) and forget them.
  private releaseAll(): void {
    for (const b of this.caught) b.dragged = false;
    this.caught = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the bulldozer without starting a cooldown (used when the finale begins).
  clear(): void {
    this.releaseAll();
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.crushTimer = 0;
    this.phase = 'seek';
    this.crushing = false;
  }

  reset(): void {
    this.clear();
    this.animTime = 0;
    this.trackPhase = 0;
    this.heading = 0;
  }
}
