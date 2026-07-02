import {
  FIRETRUCK_LIFETIME,
  FIRETRUCK_COOLDOWN,
  FIRETRUCK_FADE_DURATION,
  FIRETRUCK_SIZE_RATIO,
  FIRETRUCK_MIN_SIZE,
  FIRETRUCK_DRIVE_SPEED,
  FIRETRUCK_GROUND_LOCAL,
  FIRETRUCK_BODY_HALF_RATIO,
  FIRETRUCK_NOZZLE_DX,
  FIRETRUCK_NOZZLE_DY,
  FIRETRUCK_MAX_SWIVEL,
  FIRETRUCK_AIM_SPEED,
  FIRETRUCK_SPRAY_RANGE_RATIO,
  FIRETRUCK_SPRAY_HALF_ANGLE,
} from './constants';
import { vehicleButtonRadius, vehicleButtonX, vehicleButtonY } from './buttonLayout';

export type FiretruckState = 'idle' | 'active' | 'cooldown';

// The slice of a balloon the fire truck needs. Balloon satisfies this structurally,
// so the manager stays decoupled and unit-testable with fakes. Like the rain cloud
// the truck *claims nothing* — it only reads a balloon's position (to aim at the
// nearest one and to test the spray cone) and calls `applyWaterSlow()` on the ones
// the jet hits, so everything here is read-only except that one effect. `loaded` is
// read to skip balloons the tractor / excavator are carrying.
export interface SprayTarget {
  readonly x: number;
  readonly y: number;
  readonly loaded: boolean;
  applyWaterSlow(): void;
}

// An autonomous fire truck: summoned from its own button, it trundles along the floor
// to get under the nearest balloon, swivels a roof-mounted water monitor to track it,
// and hoses an upward fan of water. Every balloon caught in the spray cone rises
// slowly while wet and recovers once clear — the truck owns nothing, so when it fades
// the balloons simply speed back up (like the rain cloud). It roams and works on its
// own, like the bulldozer / excavator.
export class FiretruckManager {
  state: FiretruckState = 'idle';

  // Body centre x (chases its target). wheelPhase animates the rolling wheels.
  x: number = 0;
  wheelPhase: number = 0;
  // Current monitor aim, in screen radians (atan2 convention; -π/2 = straight up).
  // Eased toward the target aim each frame and read by the renderer to orient the
  // cannon and the spray fan.
  aimAngle: number = -Math.PI / 2;
  animTime: number = 0; // drives the button pulse and the procedural spray droplets

  private lifeTimer: number = 0;
  private cooldownTimer: number = 0;
  private target: SprayTarget | null = null;

  private screenWidth: number = 0;
  private screenHeight: number = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x); // keep the truck on-screen after a resize / rotation
    }
  }

  // ── Sizing / geometry ──────────────────────────────────────────────────────

  get size(): number {
    return Math.max(FIRETRUCK_MIN_SIZE, this.screenWidth * FIRETRUCK_SIZE_RATIO);
  }

  // Body centre y — fixed near the bottom so the wheels ride along the floor.
  get y(): number {
    return this.screenHeight - this.size * FIRETRUCK_GROUND_LOCAL;
  }

  // The water monitor's pivot, sitting on the rear deck above the body.
  get nozzleX(): number {
    return this.x + FIRETRUCK_NOZZLE_DX * this.size;
  }

  get nozzleY(): number {
    return this.y + FIRETRUCK_NOZZLE_DY * this.size;
  }

  // How far the jet reaches from the nozzle, and the half-angle of its spray cone.
  get sprayRange(): number {
    return this.size * FIRETRUCK_SPRAY_RANGE_RATIO;
  }

  get sprayHalfAngle(): number {
    return FIRETRUCK_SPRAY_HALF_ANGLE;
  }

  // True while the jet is on (the renderer draws the spray fan then). The truck hoses
  // continuously for its whole life, like the rain cloud rains continuously.
  get isSpraying(): boolean {
    return this.state === 'active';
  }

  private get bodyHalf(): number {
    return this.size * FIRETRUCK_BODY_HALF_RATIO;
  }

  // Keep the whole wheelbase on-screen (the jet may overhang a wall, but the truck
  // body never does).
  private clampX(x: number): number {
    const left = this.bodyHalf;
    const right = this.screenWidth - this.bodyHalf;
    if (right <= left) return this.screenWidth / 2; // body wider than the viewport — centre it
    return Math.max(left, Math.min(right, x));
  }

  // ── Spawn button (6th in the shared left-edge column) ──────────────────────

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return vehicleButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return vehicleButtonY(5, this.screenWidth, this.screenHeight);
  }

  // Fade in on spawn, fade out at end of life.
  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const remaining = FIRETRUCK_LIFETIME - this.lifeTimer;
    const fadeOut = Math.min(1, remaining / FIRETRUCK_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  // 0 → 1 as the cooldown completes (for the button's loading ring).
  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / FIRETRUCK_COOLDOWN);
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

  // Returns true if the tap summoned a fire truck.
  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle') return false;
    if (!this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.lifeTimer = 0;
    this.target = null;
    this.aimAngle = -Math.PI / 2; // monitor starts pointing straight up
    this.x = this.clampX(this.screenWidth / 2); // roll on near the centre, then seek
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  // Wanders the truck under the nearest balloon, swivels the monitor to track it, and
  // wets every balloon in the jet. The truck claims nothing, so there is no callback:
  // it just calls `applyWaterSlow()` on the targets the spray cone covers.
  update<T extends SprayTarget>(dt: number, balloons: T[]): void {
    this.animTime += dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= FIRETRUCK_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }

    if (this.state !== 'active') return;

    this.lifeTimer += dt;

    // Pick the nearest sprayable balloon to chase and aim at; drive under it (or ease
    // back toward centre when the sky is empty) and swivel the monitor onto it.
    this.target = this.pickTarget(balloons);
    const goalX = this.target ? this.target.x : this.screenWidth / 2;
    this.drive(goalX, dt);
    this.aim(dt);

    // Wet every free balloon the jet covers (the target plus any of its neighbours).
    this.sprayOn(balloons);

    if (this.lifeTimer >= FIRETRUCK_LIFETIME) {
      this.target = null;
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  // Trundle the body toward a goal x, spinning the wheels by the distance moved (so a
  // truck sitting still keeps its wheels at rest).
  private drive(goalX: number, dt: number): void {
    const goal = this.clampX(goalX);
    const dx = goal - this.x;
    const step = FIRETRUCK_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.wheelPhase += moved * 0.08;
  }

  // The nearest free balloon within the jet's reach and above the nozzle (the truck
  // hoses upward, so balloons below it are never targets). Reach is judged on the
  // *vertical* gap to the nozzle (as the excavator judges its arm reach): the truck
  // closes the horizontal gap by driving in, so any balloon at a sprayable height
  // counts. Balloons risen past the jet's vertical reach are left alone (like rain
  // only reaching the band below the cloud). Nearest is then the closest by full gap.
  private pickTarget<T extends SprayTarget>(balloons: T[]): SprayTarget | null {
    const nx = this.nozzleX;
    const ny = this.nozzleY;
    const range = this.sprayRange;
    let best: SprayTarget | null = null;
    let bestD = Infinity;
    for (const b of balloons) {
      if (b.loaded) continue;       // claimed by the tractor / excavator
      if (b.y >= ny) continue;      // at or below the nozzle — the upward jet can't reach it
      if (ny - b.y > range) continue; // risen past the jet's vertical reach
      const dx = b.x - nx;
      const dy = b.y - ny;
      const d = dx * dx + dy * dy;  // nearest first → spray the closest/lowest
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // Ease the monitor toward the aim that points at the current target, clamped to the
  // upper hemisphere so the cannon never sprays sideways or down — a far-to-the-side
  // balloon is reached by driving closer, not by flattening the jet. With no target
  // the monitor returns to straight up.
  private aim(dt: number): void {
    const desired = this.target ? this.clampAim(this.aimToTarget(this.target)) : -Math.PI / 2;
    const step = FIRETRUCK_AIM_SPEED * dt;
    let diff = desired - this.aimAngle;
    // Wrap into (-π, π] so the cannon always swings the short way round.
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(diff) <= step) {
      this.aimAngle = desired;
    } else {
      this.aimAngle += Math.sign(diff) * step;
    }
  }

  private aimToTarget(t: SprayTarget): number {
    return Math.atan2(t.y - this.nozzleY, t.x - this.nozzleX);
  }

  // Clamp an aim angle to within ±MAX_SWIVEL of straight up (-π/2).
  private clampAim(angle: number): number {
    const up = -Math.PI / 2;
    const lo = up - FIRETRUCK_MAX_SWIVEL;
    const hi = up + FIRETRUCK_MAX_SWIVEL;
    return Math.max(lo, Math.min(hi, angle));
  }

  // Wet every free balloon inside the spray cone: within the jet's reach of the
  // nozzle and within the cone half-angle of the current aim. Like the rain, the
  // gate is purely read-only — it just calls applyWaterSlow on the covered balloons.
  private sprayOn<T extends SprayTarget>(balloons: T[]): void {
    const nx = this.nozzleX;
    const ny = this.nozzleY;
    const range = this.sprayRange;
    const half = this.sprayHalfAngle;
    for (const b of balloons) {
      if (b.loaded) continue;
      const dx = b.x - nx;
      const dy = b.y - ny;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      if (dist < 1e-3) { b.applyWaterSlow(); continue; } // sitting on the nozzle
      let diff = Math.atan2(dy, dx) - this.aimAngle;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(diff) <= half) b.applyWaterSlow();
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Remove the truck without starting a cooldown (used when the finale begins).
  // Balloons it was wetting recover on their own — nothing to release.
  clear(): void {
    this.target = null;
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.wheelPhase = 0;
    this.aimAngle = -Math.PI / 2;
  }
}
