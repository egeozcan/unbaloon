import {
  PLANE_LIFETIME,
  PLANE_COOLDOWN,
  PLANE_SIZE_RATIO,
  PLANE_MIN_SIZE,
  PLANE_FADE_DURATION,
  PLANE_SPEED,
  PLANE_TURN_RATE,
  PLANE_PROP_SPEED,
  PLANE_OVERSHOOT_RATIO,
  PLANE_OVERSHOOT_MIN,
  PLANE_OVERSHOOT_MAX,
  PLANE_RUN_TURN_BIAS,
  PLANE_ARRIVE_RADIUS,
  PLANE_BUTTON_GAP,
  MISSILE_FIRE_INTERVAL,
  MISSILE_SPEED,
  MISSILE_TURN_RATE,
  MISSILE_LIFETIME,
  MISSILE_MUZZLE_OFFSET_RATIO,
  MISSILE_RANGE_RATIO,
  MISSILE_RANGE_MIN,
  MISSILE_RANGE_MAX,
  HELI_BUTTON_MARGIN,
  HELI_BUTTON_RADIUS_RATIO,
  HELI_BUTTON_MIN_RADIUS,
  HELI_BUTTON_MAX_RADIUS,
} from './constants';

export type PlaneState = 'idle' | 'active' | 'cooldown';

// Minimal shape a missile/plane needs from a balloon. Balloon satisfies this
// structurally, so the manager stays decoupled and unit-testable with fakes.
export interface MissileTarget {
  x: number;
  y: number;
  hitTest(px: number, py: number): boolean;
}

export interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  // The balloon this missile is homing toward. Re-acquired if it dies/leaves.
  target: MissileTarget | null;
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

export class PlaneManager {
  state: PlaneState = 'idle';

  // Plane position and travel heading (radians).
  x: number = 0;
  y: number = 0;
  heading: number = 0;

  propAngle: number = 0;
  missiles: Missile[] = [];

  private animTime: number = 0;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;
  private fireTimer: number = 0;

  // The point the plane strafes around: cursor on desktop, last tap on touch.
  private focusX: number = 0;
  private focusY: number = 0;

  // Direction (radians) of the current strafing run; flips/rotates each pass.
  private runAngle: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.focusX === 0 && this.focusY === 0) {
      this.focusX = width / 2;
      this.focusY = height / 2;
    }
  }

  // Keep the focus point (where the plane strafes) in sync with the pointer.
  setFocus(x: number, y: number): void {
    this.focusX = x;
    this.focusY = y;
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(PLANE_MIN_SIZE, this.screenWidth * PLANE_SIZE_RATIO);
  }

  // How far past the focus each run flies before turning around.
  get overshoot(): number {
    const o = Math.min(this.screenWidth, this.screenHeight) * PLANE_OVERSHOOT_RATIO;
    return Math.max(PLANE_OVERSHOOT_MIN, Math.min(PLANE_OVERSHOOT_MAX, o));
  }

  // How far the plane can lock onto a balloon when launching a missile.
  get missileRange(): number {
    const r = Math.min(this.screenWidth, this.screenHeight) * MISSILE_RANGE_RATIO;
    return Math.max(MISSILE_RANGE_MIN, Math.min(MISSILE_RANGE_MAX, r));
  }

  // Button mirrors the helicopter's sizing/x but stacks directly beneath it.
  get buttonRadius(): number {
    const r = Math.min(this.screenWidth, this.screenHeight) * HELI_BUTTON_RADIUS_RATIO;
    return Math.max(HELI_BUTTON_MIN_RADIUS, Math.min(HELI_BUTTON_MAX_RADIUS, r));
  }

  get buttonX(): number {
    return HELI_BUTTON_MARGIN + this.buttonRadius;
  }

  get buttonY(): number {
    // The helicopter button is centred at screenHeight / 2 with the same radius;
    // sit one diameter (plus a gap) below it.
    return this.screenHeight / 2 + this.buttonRadius * 2 + PLANE_BUTTON_GAP;
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = PLANE_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / PLANE_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / PLANE_COOLDOWN);
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

  // Returns true if the tap spawned a plane.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.fireTimer = MISSILE_FIRE_INTERVAL; // ready to fire as soon as a target exists
    this.missiles = [];
    // Launch from the button, heading toward the current focus point.
    this.x = Math.max(this.size * 0.5, this.buttonX);
    this.y = this.buttonY;
    this.runAngle = Math.atan2(this.focusY - this.y, this.focusX - this.x);
    if (!Number.isFinite(this.runAngle)) this.runAngle = 0;
    this.heading = this.runAngle;
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update<T extends MissileTarget>(
    dt: number,
    focusX: number,
    focusY: number,
    targets: T[],
    onHit: (target: T) => void,
    onFire?: () => void,
  ): void {
    this.animTime += dt;
    this.propAngle += PLANE_PROP_SPEED * dt;
    this.setFocus(focusX, focusY);

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= PLANE_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;

    this.fly(dt);
    this.fire(dt, targets, onFire);
    this.updateMissiles(dt, targets, onHit);

    if (this.lifeTimer >= PLANE_LIFETIME) {
      this.state = 'cooldown';
      this.cooldownTimer = 0;
      this.missiles = [];
    }
  }

  // Bank toward the run's waypoint — a point past the focus, kept on-screen — so
  // the plane flies through and beyond the focus. On reaching it, reverse and
  // rotate for the next pass, which returns from another direction.
  private fly(dt: number): void {
    const overshoot = this.overshoot;
    const margin = this.size * 0.5;
    // The waypoint sits past the focus along the run direction, but is clamped
    // on-screen so the turnaround is anchored where the plane can actually reach.
    const wx = Math.max(margin, Math.min(this.screenWidth - margin,
      this.focusX + Math.cos(this.runAngle) * overshoot));
    const wy = Math.max(margin, Math.min(this.screenHeight - margin,
      this.focusY + Math.sin(this.runAngle) * overshoot));

    const desired = Math.atan2(wy - this.y, wx - this.x);
    this.heading = steer(this.heading, desired, PLANE_TURN_RATE * dt);

    this.x += Math.cos(this.heading) * PLANE_SPEED * dt;
    this.y += Math.sin(this.heading) * PLANE_SPEED * dt;

    // Reached this run's waypoint → reverse direction and rotate so the next
    // pass returns from a fresh angle, sweeping around the focus over time.
    const dx = wx - this.x;
    const dy = wy - this.y;
    if (dx * dx + dy * dy <= PLANE_ARRIVE_RADIUS * PLANE_ARRIVE_RADIUS) {
      this.runAngle += Math.PI + PLANE_RUN_TURN_BIAS;
    }

    // Safety net: a banking U-turn near an edge can briefly steer outward — never
    // let the plane leave the screen entirely.
    this.x = Math.max(margin, Math.min(this.screenWidth - margin, this.x));
    this.y = Math.max(margin, Math.min(this.screenHeight - margin, this.y));
  }

  private fire<T extends MissileTarget>(dt: number, targets: T[], onFire?: () => void): void {
    this.fireTimer += dt;
    if (this.fireTimer < MISSILE_FIRE_INTERVAL) return;
    const target = this.nearestTarget(targets, this.x, this.y, this.missileRange);
    if (target) {
      this.fireMissileAt(target);
      this.fireTimer = 0;
      onFire?.();
    } else {
      this.fireTimer = MISSILE_FIRE_INTERVAL; // stay primed without accumulating
    }
  }

  private nearestTarget<T extends MissileTarget>(
    targets: T[],
    ox: number,
    oy: number,
    maxRange: number = Infinity,
  ): T | null {
    let best: T | null = null;
    let bestDist = maxRange * maxRange;
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

  private fireMissileAt(target: MissileTarget): void {
    const muzzle = this.size * MISSILE_MUZZLE_OFFSET_RATIO;
    const ox = this.x + Math.cos(this.heading) * muzzle;
    const oy = this.y + Math.sin(this.heading) * muzzle;
    const angle = Math.atan2(target.y - oy, target.x - ox);
    this.missiles.push({
      x: ox,
      y: oy,
      vx: Math.cos(angle) * MISSILE_SPEED,
      vy: Math.sin(angle) * MISSILE_SPEED,
      age: 0,
      target,
    });
  }

  private updateMissiles<T extends MissileTarget>(
    dt: number,
    targets: T[],
    onHit: (target: T) => void,
  ): void {
    const margin = 40;
    const next: Missile[] = [];
    for (const m of this.missiles) {
      // Re-acquire a target if the current one has popped or drifted away.
      if (!m.target || !m.target.hitTest(m.target.x, m.target.y)) {
        m.target = this.nearestTarget(targets, m.x, m.y);
      }

      // Home: steer the velocity toward the target, keeping a constant speed.
      if (m.target) {
        const heading = Math.atan2(m.vy, m.vx);
        const desired = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        const next2 = steer(heading, desired, MISSILE_TURN_RATE * dt);
        m.vx = Math.cos(next2) * MISSILE_SPEED;
        m.vy = Math.sin(next2) * MISSILE_SPEED;
      }

      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.age += dt;

      // Cull missiles that timed out or left the screen.
      if (
        m.age >= MISSILE_LIFETIME ||
        m.x < -margin ||
        m.x > this.screenWidth + margin ||
        m.y < -margin ||
        m.y > this.screenHeight + margin
      ) {
        continue;
      }

      // Hit test against poppable balloons in its path.
      let hit = false;
      for (const t of targets) {
        if (t.hitTest(m.x, m.y)) {
          onHit(t);
          hit = true;
          break;
        }
      }
      if (!hit) next.push(m);
    }
    this.missiles = next;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the plane without starting a cooldown (used when the finale begins).
  clear(): void {
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.fireTimer = 0;
    this.missiles = [];
  }

  reset(): void {
    this.clear();
    this.animTime = 0;
    this.propAngle = 0;
  }
}
