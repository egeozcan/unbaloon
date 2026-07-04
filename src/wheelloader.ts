import {
  WHEELLOADER_LIFETIME,
  WHEELLOADER_COOLDOWN,
  WHEELLOADER_FADE_DURATION,
  WHEELLOADER_SIZE_RATIO,
  WHEELLOADER_MIN_SIZE,
  WHEELLOADER_DRIVE_SPEED,
  WHEELLOADER_GROUND_LOCAL,
  WHEELLOADER_BODY_HALF_RATIO,
  WHEELLOADER_BUCKET_DX,
  WHEELLOADER_BUCKET_UP,
  WHEELLOADER_REACH_V_RATIO,
  WHEELLOADER_SHOVE_SPEED,
  WHEELLOADER_CONTACT_RATIO,
  WHEELLOADER_DELIVER_RATIO,
} from './constants';
import { vehicleButtonRadius, effectButtonX, effectButtonY } from './buttonLayout';

export type WheelLoaderState = 'idle' | 'active' | 'cooldown';

// A point a popping vehicle occupies — the loader shoves balloons toward the nearest
// of these. The game supplies one per *active* popper (helicopter, plane, bulldozer,
// tractor, excavator) each frame; only the x matters (the shove is horizontal).
export interface PopperPoint {
  readonly x: number;
  readonly y: number;
}

// The slice of a balloon the wheel loader needs. Balloon satisfies this structurally,
// so the manager stays decoupled and unit-testable with fakes. Like the bulldozer the
// loader *moves* its target, so it needs the writable position fields plus the
// `dragged` flag it sets to freeze a balloon's drift while shoving it (the same flag
// the game uses for finger drags). `loaded` is read to skip balloons the tractor /
// excavator have claimed.
export interface ShoveTarget {
  x: number;
  y: number;
  baseX: number;
  radiusX: number;
  radiusY: number;
  dragged: boolean;
  readonly loaded: boolean;
  hitTest(px: number, py: number): boolean;
}

// What the loader has decided to do this frame: which balloon to shove, which way, and
// the x of the popper it is shoving toward.
interface ShovePlan {
  balloon: ShoveTarget;
  dir: number;      // +1 shove right, -1 shove left
  popperX: number;
}

// An autonomous wheel loader: summoned from its own button, it trundles along the floor
// with its bucket raised, tucks in beside a low balloon on the side away from the
// nearest popping vehicle, and shoves it horizontally under that vehicle so it can be
// popped. It pops nothing itself — it only relocates balloons, freezing one just while
// it is in the bucket (like a finger drag) and releasing it the moment it is delivered
// near a popper. It roams and works on its own, like the bulldozer / excavator / truck.
export class WheelLoaderManager {
  state: WheelLoaderState = 'idle';

  // Body centre x (chases its shove position). wheelPhase animates the rolling wheels.
  x: number = 0;
  wheelPhase: number = 0;
  // Which way the loader faces (its bucket end): +1 right, -1 left. Matches the shove
  // direction while working; the renderer mirrors the body by it.
  facing: number = 1;
  // True on frames the bucket is in contact and shoving (renderer adds a little dust).
  shoving: boolean = false;
  animTime: number = 0; // drives the button pulse

  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;
  // The balloon currently frozen in the bucket, if any (so we can release it cleanly).
  private held: ShoveTarget | null = null;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x); // keep the loader on-screen after a resize / rotation
    }
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(WHEELLOADER_MIN_SIZE, this.screenWidth * WHEELLOADER_SIZE_RATIO);
  }

  // Body centre y — fixed near the bottom so the wheels ride along the floor.
  get y(): number {
    return this.screenHeight - this.size * WHEELLOADER_GROUND_LOCAL;
  }

  // The height the raised bucket catches balloons at.
  get bucketY(): number {
    return this.y - this.size * WHEELLOADER_BUCKET_UP;
  }

  // The bucket front, ahead of the body on the facing side (where it meets a balloon).
  get bucketX(): number {
    return this.x + this.facing * this.size * WHEELLOADER_BUCKET_DX;
  }

  private get bodyHalf(): number {
    return this.size * WHEELLOADER_BODY_HALF_RATIO;
  }

  // Keep the whole wheelbase on-screen (the raised bucket may overhang a wall a touch,
  // but the loader body never does).
  private clampX(x: number): number {
    const left = this.bodyHalf;
    const right = this.screenWidth - this.bodyHalf;
    if (right <= left) return this.screenWidth / 2; // body wider than the viewport — centre it
    return Math.max(left, Math.min(right, x));
  }

  // ── Spawn button (2nd in the shared right-edge effect column) ───────────────

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return effectButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return effectButtonY(1, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = WHEELLOADER_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / WHEELLOADER_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / WHEELLOADER_COOLDOWN);
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

  // Returns true if the tap summoned a wheel loader.
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
    this.shoving = false;
    this.facing = 1;
    this.x = this.clampX(this.screenWidth / 2); // roll on near the centre, then seek
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  // Wanders the loader beside the nearest low balloon and shoves it under the nearest
  // popper. The loader claims a balloon only while shoving it, so there is no pop
  // callback — it just relocates balloons (freezing the one in the bucket).
  update<T extends ShoveTarget>(dt: number, balloons: T[], poppers: readonly PopperPoint[]): void {
    this.animTime += dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= WHEELLOADER_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    this.shoving = false;

    this.work(dt, balloons, poppers);

    if (this.lifeTimer >= WHEELLOADER_LIFETIME) {
      this.release();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  private work<T extends ShoveTarget>(dt: number, balloons: T[], poppers: readonly PopperPoint[]): void {
    const plan = this.pickPlan(balloons, poppers);

    // Nothing to shove (no popper out, or every reachable balloon already delivered) —
    // let go of anything we held and ease back toward centre.
    if (!plan) {
      this.release();
      this.drive(this.screenWidth / 2, dt);
      return;
    }

    this.facing = plan.dir;

    // Tuck the bucket in beside the balloon on the side away from the popper, so the
    // bucket front meets the balloon's near edge and a shove moves it toward the popper.
    const standoff = plan.balloon.radiusX + this.size * WHEELLOADER_BUCKET_DX;
    const desiredX = this.clampX(plan.balloon.x - plan.dir * standoff);
    this.drive(desiredX, dt);

    // Grab once the body has reached its shove position (and the balloon is at a
    // catchable height, which pickPlan already guaranteed). Once grabbed the hold is
    // sticky — we keep shoving the same balloon while it stays valid (pickPlan keeps
    // returning it) even if the body lags a pixel behind, so it never stutters free.
    const alreadyHolding = this.held === plan.balloon;
    const inContact = Math.abs(this.x - desiredX) <= this.size * WHEELLOADER_CONTACT_RATIO;
    if (alreadyHolding || inContact) {
      this.shove(plan, dt);
    } else {
      this.release();
    }
  }

  // Freeze the caught balloon and slide it toward the popper. Releases it the instant it
  // is delivered (within reach of the popper's x) so the next frame moves on.
  private shove(plan: ShovePlan, dt: number): void {
    const b = plan.balloon;
    if (this.held && this.held !== b) this.release(); // switched balloons — free the old one
    this.held = b;
    b.dragged = true;
    this.shoving = true;

    const nextX = this.clampBalloonX(b.baseX + plan.dir * WHEELLOADER_SHOVE_SPEED * dt, b.radiusX);
    b.x = nextX;
    b.baseX = nextX;

    if (Math.abs(b.baseX - plan.popperX) <= this.size * WHEELLOADER_DELIVER_RATIO) {
      this.release(); // delivered — hand it off to the popper
    }
  }

  // Trundle the body toward a goal x, spinning the wheels by the distance moved.
  private drive(goalX: number, dt: number): void {
    const goal = this.clampX(goalX);
    const dx = goal - this.x;
    const step = WHEELLOADER_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.wheelPhase += moved * 0.09;
  }

  // Choose the balloon to shove and which way. Picks the nearest catchable, still-free,
  // not-yet-delivered balloon and aims it at the nearest popper. Returns null when there
  // is no popper out or nothing worth shoving.
  private pickPlan<T extends ShoveTarget>(balloons: T[], poppers: readonly PopperPoint[]): ShovePlan | null {
    if (poppers.length === 0) return null;
    const deliver = this.size * WHEELLOADER_DELIVER_RATIO;

    // Stay locked on the balloon already in the bucket while it remains valid — so we
    // finish delivering it rather than switching to a newly-nearer one mid-shove.
    // Horizontal decisions use a balloon's baseX (its stable drift column), not its
    // swaying x — otherwise the gentle sway could rock a just-delivered balloon back
    // across the delivery line and trigger an endless re-grab.
    const held = this.held;
    if (held && balloons.indexOf(held as unknown as T) !== -1 && !held.loaded &&
        held.hitTest(held.x, held.y) && this.reachable(held)) {
      const popperX = this.nearestPopperX(poppers, held.baseX);
      if (Math.abs(popperX - held.baseX) > deliver) {
        return { balloon: held, dir: Math.sign(popperX - held.baseX), popperX };
      }
    }

    let best: ShovePlan | null = null;
    let bestD = Infinity;
    for (const b of balloons) {
      if (b.loaded) continue;                       // claimed by the tractor / excavator
      if (b.dragged && b !== this.held) continue;   // held by the player or another vehicle
      if (!b.hitTest(b.x, b.y)) continue;           // only shove live (poppable) balloons
      if (!this.reachable(b)) continue;             // out of the raised bucket's height band
      const popperX = this.nearestPopperX(poppers, b.baseX);
      const gap = popperX - b.baseX;
      if (Math.abs(gap) <= deliver) continue;       // already sitting at a popper
      const d = Math.abs(b.baseX - this.x);         // nearest by horizontal distance
      if (d < bestD) {
        bestD = d;
        best = { balloon: b, dir: Math.sign(gap), popperX };
      }
    }
    return best;
  }

  // A balloon is catchable when its centre sits within the bucket's height band. Reach
  // is judged on the *vertical* gap to the bucket (the loader closes the horizontal gap
  // by driving in), like the excavator / fire truck judge their reach.
  private reachable(b: ShoveTarget): boolean {
    return Math.abs(b.y - this.bucketY) <= this.size * WHEELLOADER_REACH_V_RATIO;
  }

  private nearestPopperX(poppers: readonly PopperPoint[], x: number): number {
    let best = poppers[0].x;
    let bestD = Math.abs(best - x);
    for (const p of poppers) {
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = p.x;
      }
    }
    return best;
  }

  private clampBalloonX(x: number, r: number): number {
    return Math.max(r, Math.min(this.screenWidth - r, x));
  }

  // Release the held balloon (unfreeze) and forget it.
  private release(): void {
    if (this.held) {
      this.held.dragged = false;
      this.held = null;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the loader without starting a cooldown (used when the finale begins).
  // Releasing the held balloon lets it resume rising on its own.
  clear(): void {
    this.release();
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.shoving = false;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.wheelPhase = 0;
    this.facing = 1;
  }
}
