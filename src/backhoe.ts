import {
  BACKHOE_LIFETIME,
  BACKHOE_COOLDOWN,
  BACKHOE_FADE_DURATION,
  BACKHOE_SIZE_RATIO,
  BACKHOE_MIN_SIZE,
  BACKHOE_DRIVE_SPEED,
  BACKHOE_GROUND_LOCAL,
  BACKHOE_BODY_HALF_RATIO,
  BACKHOE_SCOOP_UP,
  BACKHOE_REACH_V_RATIO,
  BACKHOE_ARM_SPEED,
  BACKHOE_BOOM_RATIO,
  BACKHOE_STICK_RATIO,
  BACKHOE_GRAB_DIST,
  BACKHOE_RELEASE_DELAY,
  BACKHOE_RETARGET_DELAY,
} from './constants';
import { effectButtonX, effectButtonY, vehicleButtonRadius } from './buttonLayout';
import { solveTwoLinkArm } from './armKinematics';

export type BackhoeState = 'idle' | 'active' | 'cooldown';
export type BackhoeWorkPhase = 'seeking' | 'scooping' | 'swinging' | 'releasing';

export interface BackhoeTarget {
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

export class BackhoeManager {
  state: BackhoeState = 'idle';
  workPhase: BackhoeWorkPhase = 'seeking';
  x = 0;
  facing = 1;
  wheelPhase = 0;
  animTime = 0;
  elbowX = 0;
  elbowY = 0;
  bucketX = 0;
  bucketY = 0;
  bucketAngle = 0;

  private lifeTimer = 0;
  private cooldownTimer = 0;
  private releaseTimer = 0;
  private immunityTimer = 0;
  private held: BackhoeTarget | null = null;
  private target: BackhoeTarget | null = null;
  private immuneTarget: BackhoeTarget | null = null;
  private tipX = 0;
  private tipY = 0;
  private destinationX = 0;
  private destinationY = 0;
  private screenWidth = 0;
  private screenHeight = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x);
      this.destinationX = this.clampBalloonX(this.destinationX, this.held?.radiusX ?? 0);
      this.destinationY = this.clampBalloonY(this.destinationY, this.held?.radiusY ?? 0);
      this.solveArm();
      if (this.held) this.carryHeld();
    }
  }

  get size(): number {
    return Math.max(BACKHOE_MIN_SIZE, this.screenWidth * BACKHOE_SIZE_RATIO);
  }

  get y(): number {
    return this.screenHeight - this.size * BACKHOE_GROUND_LOCAL;
  }

  get shoulderX(): number {
    return this.x - this.facing * this.size * 0.20;
  }

  get shoulderY(): number {
    return this.y - this.size * 0.32;
  }

  get frontBucketX(): number {
    return this.x + this.facing * this.size * 0.62;
  }

  get frontBucketY(): number {
    return this.y - this.size * BACKHOE_SCOOP_UP;
  }

  get boomLen(): number {
    return this.size * BACKHOE_BOOM_RATIO;
  }

  get stickLen(): number {
    return this.size * BACKHOE_STICK_RATIO;
  }

  get carrying(): boolean {
    return this.held !== null;
  }

  private get bodyHalf(): number {
    return this.size * BACKHOE_BODY_HALF_RATIO;
  }

  private clampX(x: number): number {
    const left = this.bodyHalf;
    const right = this.screenWidth - this.bodyHalf;
    if (right <= left) return this.screenWidth / 2;
    return Math.max(left, Math.min(right, x));
  }

  private clampBalloonX(x: number, radius: number): number {
    return Math.max(radius + this.buttonRadius * 1.4, Math.min(
      this.screenWidth - radius - this.buttonRadius * 1.4,
      x,
    ));
  }

  private clampBalloonY(y: number, radius: number): number {
    const top = radius + 12;
    const bottom = Math.max(top, this.screenHeight - this.size * 1.25);
    return Math.max(top, Math.min(bottom, y));
  }

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return effectButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return effectButtonY(3, this.screenWidth, this.screenHeight);
  }

  get alpha(): number {
    if (this.state !== 'active') return 0;
    return Math.max(0, Math.min(
      1,
      this.lifeTimer / 0.3,
      (BACKHOE_LIFETIME - this.lifeTimer) / BACKHOE_FADE_DURATION,
    ));
  }

  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / BACKHOE_COOLDOWN);
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
    this.releaseTimer = 0;
    this.immunityTimer = 0;
    this.held = null;
    this.target = null;
    this.immuneTarget = null;
    this.x = this.clampX(this.screenWidth / 2);
    this.facing = 1;
    this.snapArmToRest();
  }

  update<T extends BackhoeTarget>(
    dt: number,
    focusX: number,
    focusY: number,
    targets: T[],
    onScoop?: () => void,
    onDrop?: () => void,
  ): void {
    this.animTime += dt;
    if (this.immunityTimer > 0) {
      this.immunityTimer -= dt;
      if (this.immunityTimer <= 0) this.immuneTarget = null;
    }

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= BACKHOE_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }
    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    if (this.held && !this.held.hitTest(this.held.x, this.held.y)) this.releaseHeld();

    if (!this.held) {
      this.workPhase = 'seeking';
      this.target = this.pickTarget(targets);
      if (this.target) {
        this.facing = this.target.x >= this.x ? 1 : -1;
        const standoff = this.target.radiusX + this.size * 0.62;
        const goalX = this.clampX(this.target.x - this.facing * standoff);
        this.drive(goalX, dt);
        if (Math.abs(this.x - goalX) <= this.size * 0.08 && this.targetStillFree(this.target)) {
          this.workPhase = 'scooping';
          this.grab(this.target, focusX, focusY);
          onScoop?.();
        }
      } else {
        this.drive(this.screenWidth / 2, dt);
        this.moveTipToward(...this.restPoint(), dt);
      }
    } else if (this.workPhase === 'swinging') {
      this.moveTipToward(this.destinationX, this.destinationY, dt);
      this.carryHeld();
      if (Math.hypot(this.tipX - this.destinationX, this.tipY - this.destinationY) <= BACKHOE_GRAB_DIST) {
        this.workPhase = 'releasing';
        this.releaseTimer = 0;
      }
    } else {
      this.releaseTimer += dt;
      this.carryHeld();
      if (this.releaseTimer >= BACKHOE_RELEASE_DELAY) {
        this.dropHeld();
        onDrop?.();
      }
    }

    this.solveArm();
    if (this.held) this.carryHeld();

    if (this.lifeTimer >= BACKHOE_LIFETIME) {
      this.releaseHeld();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  private pickTarget<T extends BackhoeTarget>(targets: T[]): T | null {
    let best: T | null = null;
    let bestY = -Infinity;
    for (const target of targets) {
      if (target === this.immuneTarget || !this.targetStillFree(target)) continue;
      if (Math.abs(target.y - this.frontBucketY) > this.size * BACKHOE_REACH_V_RATIO) continue;
      if (target.y > bestY) {
        bestY = target.y;
        best = target;
      }
    }
    return best;
  }

  private targetStillFree(target: BackhoeTarget): boolean {
    return !target.loaded && !target.dragged && target.isDraggable && target.hitTest(target.x, target.y);
  }

  private grab(target: BackhoeTarget, focusX: number, focusY: number): void {
    this.held = target;
    this.target = null;
    target.loaded = true;
    this.tipX = this.frontBucketX;
    this.tipY = this.frontBucketY;
    [this.destinationX, this.destinationY] = this.reachableDestination(
      this.clampBalloonX(focusX, target.radiusX),
      this.clampBalloonY(focusY, target.radiusY),
      target.radiusX,
      target.radiusY,
    );
    this.workPhase = 'swinging';
    this.solveArm();
    this.carryHeld();
  }

  private reachableDestination(x: number, y: number, radiusX: number, radiusY: number): [number, number] {
    const dx = x - this.shoulderX;
    const dy = y - this.shoulderY;
    const distance = Math.hypot(dx, dy) || 1;
    const reach = (this.boomLen + this.stickLen) * 0.92;
    if (distance <= reach) return [x, y];
    return [
      this.clampBalloonX(this.shoulderX + (dx / distance) * reach, radiusX),
      this.clampBalloonY(this.shoulderY + (dy / distance) * reach, radiusY),
    ];
  }

  private dropHeld(): void {
    if (!this.held) return;
    const released = this.held;
    released.x = this.destinationX;
    released.baseX = released.x;
    released.y = this.destinationY;
    released.loaded = false;
    this.held = null;
    this.immuneTarget = released;
    this.immunityTimer = BACKHOE_RETARGET_DELAY;
    this.workPhase = 'seeking';
    this.snapArmToRest();
  }

  private releaseHeld(): void {
    if (this.held) {
      this.held.loaded = false;
      this.held = null;
    }
    this.workPhase = 'seeking';
    this.releaseTimer = 0;
  }

  private carryHeld(): void {
    if (!this.held) return;
    this.held.x = this.bucketX;
    this.held.y = this.bucketY;
    this.held.baseX = this.held.x;
  }

  private drive(goalX: number, dt: number): void {
    const dx = this.clampX(goalX) - this.x;
    const step = BACKHOE_DRIVE_SPEED * dt;
    const moved = Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    this.x += moved;
    this.wheelPhase += moved * 0.09;
  }

  private restPoint(): [number, number] {
    return [this.x - this.facing * this.size * 0.54, this.y - this.size * 0.48];
  }

  private moveTipToward(goalX: number, goalY: number, dt: number): void {
    const dx = goalX - this.tipX;
    const dy = goalY - this.tipY;
    const distance = Math.hypot(dx, dy);
    const step = BACKHOE_ARM_SPEED * dt;
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
    this.target = null;
    this.immuneTarget = null;
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.immunityTimer = 0;
    this.snapArmToRest();
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.wheelPhase = 0;
    this.facing = 1;
  }
}
