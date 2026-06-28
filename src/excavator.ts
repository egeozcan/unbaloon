import {
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

// What the excavator reads off the rain cloud it lives under. RainCloudManager
// satisfies this structurally (all getters), so the two stay decoupled: the
// excavator follows the cloud's x, fades with its alpha, switches on/off with its
// active flag, and only grabs balloons inside the downpour column below the base.
export interface DownpourSource {
  readonly isActive: boolean;
  readonly alpha: number;
  readonly x: number;
  readonly rainHalfWidth: number;
  readonly cloudBaseY: number;
}

// A digger that trundles along the floor beneath an active rain cloud, reaching up
// with a two-segment arm to pluck rain-slowed balloons from the column and chomp
// them with its bucket. It owns no state machine of its own — `active`/`alpha`/`x`
// all track the cloud passed to update().
export class ExcavatorManager {
  // Body centre x (chases the cloud). alpha mirrors the cloud's fade.
  x: number = 0;
  alpha: number = 0;
  trackPhase: number = 0; // animates the rolling tracks (advances only while driving)

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
  private wasActive: boolean = false;

  // The balloon currently clamped in the bucket, and the chomp-bite timer.
  private held: GrabTarget | null = null;
  private target: GrabTarget | null = null;
  private crushTimer: number = 0;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.wasActive) {
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

  get isActive(): boolean {
    return this.wasActive;
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
  // when a balloon is first caught. Reads everything it needs about the cloud (its
  // x, downpour column and on/off) from `cloud`, and scans `balloons` (the free,
  // un-loaded ones) only to acquire new targets.
  update<T extends GrabTarget>(
    dt: number,
    cloud: DownpourSource,
    balloons: T[],
    onChomp: (target: T) => void,
    onGrab?: () => void,
  ): void {
    this.animTime += dt;
    this.alpha = cloud.alpha;
    this.chompPulse = Math.max(0, this.chompPulse - dt / EXCAVATOR_CHOMP_INTERVAL);

    if (!cloud.isActive) {
      // The cloud is gone — drop anything held and go dormant until it returns.
      this.releaseHeld();
      this.target = null;
      this.gripping = false;
      this.wasActive = false;
      return;
    }

    if (!this.wasActive) {
      // A fresh cloud was just summoned overhead — pop in directly beneath it.
      this.wasActive = true;
      this.x = this.clampX(cloud.x);
      this.snapArmToRest();
    }

    this.drive(cloud.x, dt);

    if (this.held) {
      this.crushHeld(dt, onChomp);
    } else {
      this.target = this.pickTarget(cloud, balloons);
    }

    this.moveArm(dt);

    // Reaching and the bucket tip has met the target's grip point → catch it.
    if (!this.held && this.target && this.reachedTarget()) {
      this.grab(this.target as T, onChomp, onGrab);
    }

    if (this.held) this.carryHeld();
    this.gripping = this.held !== null;
  }

  // Trundle the base toward the cloud's x, spinning the tracks by the distance moved
  // (so a digger parked under a still cloud sits with its tracks at rest).
  private drive(cloudX: number, dt: number): void {
    const goal = this.clampX(cloudX);
    const dx = goal - this.x;
    const step = EXCAVATOR_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.trackPhase += moved * 0.05;
  }

  // Nearest free, poppable balloon sitting in the downpour column below the cloud
  // base and within arm's reach. Nearest-to-shoulder keeps the choice stable and
  // makes the digger grab the closest balloon first.
  private pickTarget<T extends GrabTarget>(cloud: DownpourSource, balloons: T[]): GrabTarget | null {
    const sx = this.shoulderX;
    const sy = this.shoulderY;
    const reach = this.maxReach * EXCAVATOR_REACH_MARGIN;
    // The arm also has an unreachable inner circle (a two-link arm can't fold past
    // |boom − stick|). Ignore balloons inside it so the digger never fixates on one
    // its bucket can't physically touch — it would block every other grab.
    const minReach = Math.max(0, Math.abs(this.boomLen - this.stickLen) - EXCAVATOR_GRAB_DIST);
    const colHalf = cloud.rainHalfWidth;
    let best: GrabTarget | null = null;
    let bestD = Infinity;
    for (const b of balloons) {
      if (b.loaded || b.dragged || !b.isDraggable) continue; // claimed / a finger / a non-grabbable special
      if (!b.hitTest(b.x, b.y)) continue;            // only live, poppable balloons
      if (b.y < cloud.cloudBaseY) continue;          // must be down in the rain, not up by the cloud
      if (Math.abs(b.x - cloud.x) > colHalf + b.radiusX) continue; // inside the downpour column
      const [gx, gy] = this.grabPointOf(b);
      const d = Math.hypot(gx - sx, gy - sy);
      if (d > reach || d < minReach) continue;       // outside the arm's reachable annulus
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

  // Drop anything held and go dormant immediately (used when the finale begins, so
  // a held balloon is freed at once rather than waiting for the cloud to clear).
  clear(): void {
    this.releaseHeld();
    this.target = null;
    this.gripping = false;
    this.wasActive = false;
    this.alpha = 0;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.trackPhase = 0;
    this.chompPulse = 0;
  }
}
