import {
  EXCAVATOR_LIFETIME,
  EXCAVATOR_COOLDOWN,
  EXCAVATOR_FADE_DURATION,
  EXCAVATOR_SIZE_RATIO,
  EXCAVATOR_MIN_SIZE,
  EXCAVATOR_DRIVE_SPEED,
  EXCAVATOR_GROUND_LOCAL,
  EXCAVATOR_BODY_HALF_RATIO,
  EXCAVATOR_BOOM_RATIO,
  EXCAVATOR_STICK_RATIO,
  EXCAVATOR_REACH_MARGIN,
  EXCAVATOR_SHOULDER_DX,
  EXCAVATOR_SHOULDER_DY,
  EXCAVATOR_ARM_SPEED,
  EXCAVATOR_GRAB_DIST,
  EXCAVATOR_GRAB_RISE,
  EXCAVATOR_CHOMP_INTERVAL,
} from './constants';
import { vehicleButtonRadius, vehicleButtonX, vehicleButtonY } from './buttonLayout';

export type ExcavatorState = 'idle' | 'active' | 'cooldown';

// The slice of a balloon the excavator needs. Balloon satisfies this structurally,
// so the manager stays decoupled and unit-testable with fakes. Like the tractor the
// excavator *holds* its target, so it needs the writable position fields plus the
// `loaded` flag it sets to claim a balloon — claiming freezes the balloon's drift
// and excludes it from every other interaction (player taps and all other vehicles
// skip a loaded balloon). `dragged`/`isDraggable` are read only: to skip balloons a
// finger or the bulldozer is already holding, and the non-draggable specials (which,
// as with the tractor, stay the player's to pop).
export interface GrabTarget {
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

// An autonomous tracked digger: summoned from its own button, it trundles along the
// floor to get beneath the nearest reachable balloon, reaches up with a two-segment
// arm to grab it, hauls it aloft and chomps it with the bucket until it pops, then
// moves on to the next — roaming and working on its own, like the bulldozer.
export class ExcavatorManager {
  state: ExcavatorState = 'idle';

  // Body centre x (chases its target). trackPhase animates the rolling tracks.
  x: number = 0;
  trackPhase: number = 0;

  // Arm joint positions in world space, recomputed each frame by the IK solver and
  // read by the renderer. The bucket sits at (bucketX, bucketY).
  elbowX: number = 0;
  elbowY: number = 0;
  bucketX: number = 0;
  bucketY: number = 0;
  bucketAngle: number = 0; // stick direction (elbow → bucket), for orienting the scoop
  // True while a balloon is in the bucket (jaw clamped); chompPulse spikes to 1 on
  // each bite and decays, driving the renderer's jaw snap.
  gripping: boolean = false;
  chompPulse: number = 0;

  private tipX: number = 0; // eased bucket-tip goal tracker (world space)
  private tipY: number = 0;
  private animTime: number = 0;
  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;

  // The balloon currently clamped in the bucket, the one being approached, and the
  // chomp-bite timer.
  private held: GrabTarget | null = null;
  private target: GrabTarget | null = null;
  private crushTimer: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x); // keep the body on-screen after a resize / rotation
      // A held balloon keeps its haul pose and chomp cadence across a resize; only
      // re-fold the arm when it's empty (the bucket would otherwise jump to rest).
      if (!this.held) this.snapArmToRest();
    }
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(EXCAVATOR_MIN_SIZE, this.screenWidth * EXCAVATOR_SIZE_RATIO);
  }

  // Body centre y — fixed near the bottom so the tracks ride along the floor.
  get y(): number {
    return this.screenHeight - this.size * EXCAVATOR_GROUND_LOCAL;
  }

  get shoulderX(): number {
    return this.x + EXCAVATOR_SHOULDER_DX * this.size;
  }

  get shoulderY(): number {
    return this.y + EXCAVATOR_SHOULDER_DY * this.size;
  }

  get boomLen(): number {
    return this.size * EXCAVATOR_BOOM_RATIO;
  }

  get stickLen(): number {
    return this.size * EXCAVATOR_STICK_RATIO;
  }

  get maxReach(): number {
    return this.boomLen + this.stickLen;
  }

  private get bodyHalf(): number {
    return this.size * EXCAVATOR_BODY_HALF_RATIO;
  }

  // Keep the whole track base on-screen (the arm may overhang a wall, like a real
  // excavator, but the body never does).
  private clampX(x: number): number {
    const left = this.bodyHalf;
    const right = this.screenWidth - this.bodyHalf;
    if (right <= left) return this.screenWidth / 2; // body wider than the viewport — centre it
    return Math.max(left, Math.min(right, x));
  }

  // ── Spawn button (5th in the shared left-edge column) ──────────────────────

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return vehicleButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return vehicleButtonY(4, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = EXCAVATOR_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / EXCAVATOR_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / EXCAVATOR_COOLDOWN);
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

  buttonHitTest(px: number, py: number): boolean {
    const dx = px - this.buttonX;
    const dy = py - this.buttonY;
    const r = this.buttonRadius * 1.25; // generous touch target
    return dx * dx + dy * dy <= r * r;
  }

  // Returns true if the tap summoned an excavator.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.held = null;
    this.target = null;
    this.crushTimer = 0;
    this.x = this.clampX(this.screenWidth / 2); // roll on near the centre, then seek
    this.snapArmToRest();
  }

  // ── Goal points (world space) the bucket tip eases toward ──────────────────

  // Where the bucket grips a balloon: a little above its centre, so the scoop bites
  // it from above. (Used both to aim while reaching and to seat the held balloon.)
  private grabPointOf(b: GrabTarget): [number, number] {
    return [b.x, b.y - EXCAVATOR_GRAB_RISE * b.radiusY];
  }

  // Folded-away pose when there is nothing to grab: bucket tucked up in front.
  private restPoint(): [number, number] {
    const s = this.size;
    return [this.x + 0.34 * s, this.y - 0.52 * s];
  }

  // Where a caught balloon is hauled up to be chomped: aloft, just over the cab.
  private haulPoint(): [number, number] {
    const s = this.size;
    return [this.x + 0.04 * s, this.y - 1.04 * s];
  }

  private goal(): [number, number] {
    if (this.held) return this.haulPoint();
    if (this.target) return this.grabPointOf(this.target);
    return this.restPoint();
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  // `onChomp` taps a held balloon (sheds a layer / pops it); `onGrab` fires once
  // when a balloon is first caught. Scans `balloons` (the free, un-loaded ones) to
  // pick the next target and tracks its held balloon by its own reference.
  update<T extends GrabTarget>(
    dt: number,
    balloons: T[],
    onChomp: (target: T) => void,
    onGrab?: () => void,
  ): void {
    this.animTime += dt;
    this.chompPulse = Math.max(0, this.chompPulse - dt / EXCAVATOR_CHOMP_INTERVAL);

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= EXCAVATOR_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;

    if (this.held) {
      // Hold position and chomp the caught balloon until it pops.
      this.crushHeld(dt, onChomp);
    } else {
      // Seek the nearest reachable balloon and trundle in under it.
      this.target = this.pickTarget(balloons);
      if (this.target) this.drive(this.target.x, dt);
    }

    this.moveArm(dt);

    // Reaching and the bucket tip has met the target's grip point → catch it.
    if (!this.held && this.target && this.reachedTarget()) {
      this.grab(this.target as T, onChomp, onGrab);
    }

    if (this.held) this.carryHeld();
    this.gripping = this.held !== null;

    if (this.lifeTimer >= EXCAVATOR_LIFETIME) {
      this.releaseHeld();
      this.target = null;
      this.gripping = false;
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  // Trundle the base toward a goal x, spinning the tracks by the distance moved (so
  // a digger sitting still — holding or with no target — keeps its tracks at rest).
  private drive(goalX: number, dt: number): void {
    const goal = this.clampX(goalX);
    const dx = goal - this.x;
    const step = EXCAVATOR_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.trackPhase += moved * 0.05;
  }

  // Nearest free, poppable balloon the arm can reach once the base drives in under
  // it. Reachability is judged on the *vertical* gap to the shoulder (the base
  // closes the horizontal gap), keeping the digger out of its own unreachable inner
  // dead zone and away from balloons that have risen out of reach overhead.
  private pickTarget<T extends GrabTarget>(balloons: T[]): GrabTarget | null {
    const sx = this.shoulderX;
    const sy = this.shoulderY;
    const reach = this.maxReach * EXCAVATOR_REACH_MARGIN;
    const minReach = Math.max(0, Math.abs(this.boomLen - this.stickLen) - EXCAVATOR_GRAB_DIST);
    let best: GrabTarget | null = null;
    let bestD = Infinity;
    for (const b of balloons) {
      if (b.loaded || b.dragged || !b.isDraggable) continue; // claimed / a finger / a non-grabbable special
      if (!b.hitTest(b.x, b.y)) continue;                    // only live, poppable balloons
      const gy = b.y - EXCAVATOR_GRAB_RISE * b.radiusY;
      const vert = Math.abs(gy - sy);
      if (vert > reach || vert < minReach) continue;         // unreachable height (too high, or its own dead zone)
      const dx = b.x - sx;
      const dy = gy - sy;
      const d = dx * dx + dy * dy;                           // nearest first → grab the closest/lowest
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // Ease the bucket tip toward its current goal, then re-solve the arm.
  private moveArm(dt: number): void {
    const [gx, gy] = this.goal();
    const dx = gx - this.tipX;
    const dy = gy - this.tipY;
    const dist = Math.hypot(dx, dy);
    const step = EXCAVATOR_ARM_SPEED * dt;
    if (dist <= step || dist === 0) {
      this.tipX = gx;
      this.tipY = gy;
    } else {
      this.tipX += (dx / dist) * step;
      this.tipY += (dy / dist) * step;
    }
    this.solveArm();
  }

  // Two-link inverse kinematics: place the elbow so the boom runs shoulder → elbow
  // and the stick runs elbow → bucket (the eased tip). The tip is clamped into the
  // arm's reachable annulus first so a goal beyond reach just extends the arm fully.
  private solveArm(): void {
    const sx = this.shoulderX;
    const sy = this.shoulderY;
    const L1 = this.boomLen;
    const L2 = this.stickLen;
    const maxR = L1 + L2;
    const minR = Math.abs(L1 - L2) + 0.001;

    let dx = this.tipX - sx;
    let dy = this.tipY - sy;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4) {
      // Degenerate (tip resting on the shoulder) — fold the arm straight up by
      // default rather than down through the body (screen y grows downward).
      dx = 0;
      dy = -1e-4;
      d = 1e-4;
    }
    const clamped = Math.max(minR, Math.min(maxR, d));
    if (clamped !== d) {
      dx = (dx / d) * clamped;
      dy = (dy / d) * clamped;
      d = clamped;
      this.tipX = sx + dx;
      this.tipY = sy + dy;
    }

    const ang = Math.atan2(dy, dx);
    const cosA = (d * d + L1 * L1 - L2 * L2) / (2 * L1 * d);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    // Of the two elbow solutions (mirror images across the shoulder→tip line), keep
    // the one with the higher elbow (smaller y) so the boom rises and the stick
    // descends to the bucket — the classic excavator silhouette, for any target.
    const b1 = ang - A;
    const b2 = ang + A;
    const ey1 = sy + Math.sin(b1) * L1;
    const ey2 = sy + Math.sin(b2) * L1;
    const boomAng = ey1 <= ey2 ? b1 : b2;

    this.elbowX = sx + Math.cos(boomAng) * L1;
    this.elbowY = sy + Math.sin(boomAng) * L1;
    this.bucketX = this.tipX;
    this.bucketY = this.tipY;
    this.bucketAngle = Math.atan2(this.bucketY - this.elbowY, this.bucketX - this.elbowX);
  }

  // The bucket tip has eased onto the target's grip point.
  private reachedTarget(): boolean {
    if (!this.target) return false;
    const [gx, gy] = this.grabPointOf(this.target);
    return Math.hypot(this.bucketX - gx, this.bucketY - gy) <= EXCAVATOR_GRAB_DIST;
  }

  // Clamp a balloon into the bucket and take a first bite straight away.
  private grab<T extends GrabTarget>(target: T, onChomp: (t: T) => void, onGrab?: () => void): void {
    this.held = target;
    this.target = null;
    target.loaded = true;
    target.baseX = target.x;
    this.crushTimer = 0;
    onGrab?.();
    this.bite(onChomp);
  }

  // Hold the caught balloon in the bucket and chomp it on a steady cadence.
  private crushHeld<T extends GrabTarget>(dt: number, onChomp: (t: T) => void): void {
    if (!this.held) return;
    this.crushTimer += dt;
    if (this.crushTimer >= EXCAVATOR_CHOMP_INTERVAL) {
      this.crushTimer = 0;
      this.bite(onChomp);
    }
  }

  // One chomp: a bite spike for the renderer, the tap, then release if it popped.
  private bite<T extends GrabTarget>(onChomp: (t: T) => void): void {
    if (!this.held) return;
    this.chompPulse = 1;
    onChomp(this.held as T);
    if (this.held && !this.held.hitTest(this.held.x, this.held.y)) {
      this.releaseHeld(); // popped — let its burst play out where it sits, free the bucket
    }
  }

  // Seat the held balloon in the bucket (it hangs just below the scoop teeth).
  private carryHeld(): void {
    if (!this.held) return;
    this.held.x = this.bucketX;
    this.held.y = this.bucketY + EXCAVATOR_GRAB_RISE * this.held.radiusY;
    this.held.baseX = this.held.x;
  }

  private releaseHeld(): void {
    if (this.held) {
      this.held.loaded = false;
      this.held = null;
    }
    this.crushTimer = 0;
    this.gripping = false;
  }

  private snapArmToRest(): void {
    const [rx, ry] = this.restPoint();
    this.tipX = rx;
    this.tipY = ry;
    this.crushTimer = 0;
    this.chompPulse = 0;
    this.solveArm();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the excavator without starting a cooldown (used when the finale begins),
  // dropping anything held at once.
  clear(): void {
    this.releaseHeld();
    this.target = null;
    this.gripping = false;
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.trackPhase = 0;
    this.chompPulse = 0;
  }
}
