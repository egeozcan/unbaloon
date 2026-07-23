import {
  WHEELED_EXCAVATOR_LIFETIME,
  WHEELED_EXCAVATOR_COOLDOWN,
  WHEELED_EXCAVATOR_FADE_DURATION,
  WHEELED_EXCAVATOR_SIZE_RATIO,
  WHEELED_EXCAVATOR_MIN_SIZE,
  WHEELED_EXCAVATOR_DRIVE_SPEED,
  WHEELED_EXCAVATOR_GROUND_LOCAL,
  WHEELED_EXCAVATOR_BODY_HALF_RATIO,
  WHEELED_EXCAVATOR_BOOM_RATIO,
  WHEELED_EXCAVATOR_STICK_RATIO,
  WHEELED_EXCAVATOR_REACH_MARGIN,
  WHEELED_EXCAVATOR_ARM_SPEED,
  WHEELED_EXCAVATOR_GRAB_DIST,
  WHEELED_EXCAVATOR_SWING_SPEED,
  WHEELED_EXCAVATOR_SWING_ARC,
  WHEELED_EXCAVATOR_HIT_CAP,
} from './constants';
import { effectButtonX, effectButtonY, vehicleButtonRadius } from './buttonLayout';
import { solveTwoLinkArm } from './armKinematics';

export type WheeledExcavatorState = 'idle' | 'active' | 'cooldown';
export type WheeledExcavatorPhase = 'seeking' | 'reaching' | 'swinging';

export interface SwingTarget {
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

export class WheeledExcavatorManager {
  state: WheeledExcavatorState = 'idle';
  workPhase: WheeledExcavatorPhase = 'seeking';
  x = 0;
  facing = 1;
  wheelPhase = 0;
  houseAngle = 0;
  animTime = 0;
  elbowX = 0;
  elbowY = 0;
  bucketX = 0;
  bucketY = 0;
  bucketAngle = 0;
  bonkPulse = 0;

  private lifeTimer = 0;
  private cooldownTimer = 0;
  private held: SwingTarget | null = null;
  private target: SwingTarget | null = null;
  private tipX = 0;
  private tipY = 0;
  private swingAngle = 0;
  private swingTravel = 0;
  private swingHits = new Set<SwingTarget>();
  private screenWidth = 0;
  private screenHeight = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x);
      this.solveArm();
      if (this.held) this.carryHeld();
    }
  }

  get size(): number {
    return Math.max(WHEELED_EXCAVATOR_MIN_SIZE, this.screenWidth * WHEELED_EXCAVATOR_SIZE_RATIO);
  }

  get y(): number {
    return this.screenHeight - this.size * WHEELED_EXCAVATOR_GROUND_LOCAL;
  }

  get shoulderX(): number {
    return this.x + Math.cos(this.houseAngle) * this.size * 0.05;
  }

  get shoulderY(): number {
    return this.y - this.size * 0.20;
  }

  get boomLen(): number {
    return this.size * WHEELED_EXCAVATOR_BOOM_RATIO;
  }

  get stickLen(): number {
    return this.size * WHEELED_EXCAVATOR_STICK_RATIO;
  }

  get maxReach(): number {
    return this.boomLen + this.stickLen;
  }

  get gripping(): boolean {
    return this.held !== null;
  }

  private get bodyHalf(): number {
    return this.size * WHEELED_EXCAVATOR_BODY_HALF_RATIO;
  }

  private clampX(x: number): number {
    const left = this.bodyHalf;
    const right = this.screenWidth - this.bodyHalf;
    if (right <= left) return this.screenWidth / 2;
    return Math.max(left, Math.min(right, x));
  }

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return effectButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return effectButtonY(4, this.screenWidth, this.screenHeight);
  }

  get alpha(): number {
    if (this.state !== 'active') return 0;
    return Math.max(0, Math.min(
      1,
      this.lifeTimer / 0.3,
      (WHEELED_EXCAVATOR_LIFETIME - this.lifeTimer) / WHEELED_EXCAVATOR_FADE_DURATION,
    ));
  }

  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / WHEELED_EXCAVATOR_COOLDOWN);
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  get isAvailable(): boolean {
    return this.state === 'idle';
  }

  get buttonPulse(): number {
    return 0.5 + 0.5 * Math.sin(this.animTime * Math.PI * 2 * 0.8);
  }

  buttonHitTest(px: number, py: number): boolean {
    const dx = px - this.buttonX;
    const dy = py - this.buttonY;
    const r = this.buttonRadius * 1.25;
    return dx * dx + dy * dy <= r * r;
  }

  trySpawn(px: number, py: number): boolean {
    if (this.state !== 'idle' || !this.buttonHitTest(px, py)) return false;
    this.spawn();
    return true;
  }

  spawn(): void {
    this.state = 'active';
    this.workPhase = 'seeking';
    this.lifeTimer = 0;
    this.held = null;
    this.target = null;
    this.swingHits.clear();
    this.swingTravel = 0;
    this.bonkPulse = 0;
    this.x = this.clampX(this.screenWidth / 2);
    this.houseAngle = -Math.PI / 2;
    this.snapArmToRest();
  }

  update<T extends SwingTarget>(
    dt: number,
    targets: T[],
    onBonk: (target: T) => void,
    onGrab?: () => void,
  ): void {
    this.animTime += dt;
    this.bonkPulse = Math.max(0, this.bonkPulse - dt * 5);

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= WHEELED_EXCAVATOR_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }
    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    if (this.held && !this.held.hitTest(this.held.x, this.held.y)) this.releaseHeld();

    if (this.held) {
      this.swing(dt, targets, onBonk);
    } else {
      this.seek(dt, targets, onGrab);
    }

    if (this.lifeTimer >= WHEELED_EXCAVATOR_LIFETIME) {
      this.releaseHeld();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  private seek<T extends SwingTarget>(dt: number, targets: T[], onGrab?: () => void): void {
    this.target = this.pickTarget(targets);
    if (!this.target) {
      this.workPhase = 'seeking';
      this.drive(this.screenWidth / 2, dt);
      this.moveTipToward(...this.restPoint(), dt);
      this.solveArm();
      return;
    }

    this.workPhase = 'reaching';
    this.facing = this.target.x >= this.x ? 1 : -1;
    const goalX = this.clampX(this.target.x);
    this.drive(goalX, dt);
    const grabX = this.target.x;
    const grabY = this.target.y - this.target.radiusY * 0.25;
    this.moveTipToward(grabX, grabY, dt);
    this.solveArm();

    if (
      this.targetStillFree(this.target) &&
      Math.hypot(this.bucketX - grabX, this.bucketY - grabY) <= WHEELED_EXCAVATOR_GRAB_DIST
    ) {
      this.grab(this.target);
      onGrab?.();
    }
  }

  private swing<T extends SwingTarget>(dt: number, targets: T[], onBonk: (target: T) => void): void {
    if (!this.held) return;
    this.workPhase = 'swinging';
    const previousX = this.held.x;
    const previousY = this.held.y;
    const delta = WHEELED_EXCAVATOR_SWING_SPEED * dt;
    this.swingAngle += delta;
    this.swingTravel += delta;
    this.houseAngle = this.swingAngle;

    const radius = this.maxReach * 0.72;
    this.tipX = this.shoulderX + Math.cos(this.swingAngle) * radius;
    this.tipY = this.shoulderY + Math.sin(this.swingAngle) * radius;
    this.solveArm();
    this.carryHeld();
    this.hitAlongSegment(previousX, previousY, this.held.x, this.held.y, targets, onBonk);

    if (this.swingTravel >= WHEELED_EXCAVATOR_SWING_ARC) {
      const held = this.held as T;
      onBonk(held);
      this.bonkPulse = 1;
      this.releaseHeld();
      this.workPhase = 'seeking';
      this.snapArmToRest();
    }
  }

  private hitAlongSegment<T extends SwingTarget>(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    targets: T[],
    onBonk: (target: T) => void,
  ): void {
    if (!this.held || this.swingHits.size >= WHEELED_EXCAVATOR_HIT_CAP) return;
    for (const target of targets) {
      if (target === this.held || this.swingHits.has(target)) continue;
      if (!this.targetStillFree(target)) continue;
      const distance = segmentPointDistance(ax, ay, bx, by, target.x, target.y);
      const reach = Math.max(target.radiusX, target.radiusY) + this.held.radiusX * 0.65;
      if (distance > reach) continue;
      this.swingHits.add(target);
      onBonk(target);
      this.bonkPulse = 1;
      if (this.swingHits.size >= WHEELED_EXCAVATOR_HIT_CAP) return;
    }
  }

  private pickTarget<T extends SwingTarget>(targets: T[]): T | null {
    const reach = this.maxReach * WHEELED_EXCAVATOR_REACH_MARGIN;
    let best: T | null = null;
    let bestDistance = Infinity;
    for (const target of targets) {
      if (!this.targetStillFree(target)) continue;
      const grabY = target.y - target.radiusY * 0.25;
      if (Math.abs(grabY - this.shoulderY) > reach) continue;
      const distance = Math.hypot(target.x - this.x, grabY - this.shoulderY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = target;
      }
    }
    return best;
  }

  private targetStillFree(target: SwingTarget): boolean {
    return !target.loaded && !target.dragged && target.isDraggable && target.hitTest(target.x, target.y);
  }

  private grab(target: SwingTarget): void {
    this.held = target;
    this.target = null;
    target.loaded = true;
    this.swingHits.clear();
    this.swingTravel = 0;
    this.swingAngle = -Math.PI * 0.9;
    this.houseAngle = this.swingAngle;
    this.carryHeld();
  }

  private carryHeld(): void {
    if (!this.held) return;
    this.held.x = this.bucketX;
    this.held.y = this.bucketY + this.held.radiusY * 0.22;
    this.held.baseX = this.held.x;
  }

  private releaseHeld(): void {
    if (this.held) {
      this.held.loaded = false;
      this.held = null;
    }
    this.swingHits.clear();
    this.swingTravel = 0;
    this.target = null;
  }

  private drive(goalX: number, dt: number): void {
    const dx = this.clampX(goalX) - this.x;
    const step = WHEELED_EXCAVATOR_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.wheelPhase += moved * 0.09;
  }

  private restPoint(): [number, number] {
    return [this.x + this.facing * this.size * 0.42, this.y - this.size * 0.60];
  }

  private moveTipToward(goalX: number, goalY: number, dt: number): void {
    const dx = goalX - this.tipX;
    const dy = goalY - this.tipY;
    const distance = Math.hypot(dx, dy);
    const step = WHEELED_EXCAVATOR_ARM_SPEED * dt;
    if (distance <= step || distance === 0) {
      this.tipX = goalX;
      this.tipY = goalY;
    } else {
      this.tipX += (dx / distance) * step;
      this.tipY += (dy / distance) * step;
    }
  }

  private solveArm(): void {
    const arm = solveTwoLinkArm(
      this.shoulderX,
      this.shoulderY,
      this.tipX,
      this.tipY,
      this.boomLen,
      this.stickLen,
    );
    this.elbowX = arm.elbowX;
    this.elbowY = arm.elbowY;
    this.tipX = arm.tipX;
    this.tipY = arm.tipY;
    this.bucketX = arm.tipX;
    this.bucketY = arm.tipY;
    this.bucketAngle = arm.endAngle;
  }

  private snapArmToRest(): void {
    [this.tipX, this.tipY] = this.restPoint();
    this.solveArm();
  }

  clear(): void {
    this.releaseHeld();
    this.state = 'idle';
    this.workPhase = 'seeking';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.bonkPulse = 0;
    this.snapArmToRest();
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.wheelPhase = 0;
    this.houseAngle = 0;
    this.facing = 1;
  }
}

function segmentPointDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
