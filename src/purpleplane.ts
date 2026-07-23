import {
  PURPLE_PLANE_LIFETIME,
  PURPLE_PLANE_COOLDOWN,
  PURPLE_PLANE_FADE_DURATION,
  PURPLE_PLANE_SIZE_RATIO,
  PURPLE_PLANE_MIN_SIZE,
  PURPLE_PLANE_SPEED,
  PURPLE_PLANE_TURN_RATE,
  PURPLE_PLANE_PROP_SPEED,
  PURPLE_PLANE_OVERSHOOT_RATIO,
  PURPLE_PLANE_ARRIVE_RADIUS,
  PURPLE_PLANE_TRAIL_LIFETIME,
  PURPLE_PLANE_TRAIL_SPACING,
  PURPLE_PLANE_MARK_RADIUS,
  PURPLE_PLANE_MARK_CAP,
} from './constants';
import { effectButtonX, effectButtonY, vehicleButtonRadius } from './buttonLayout';

export type PurplePlaneState = 'idle' | 'active' | 'cooldown';

export interface SkywriterTarget {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  readonly loaded: boolean;
  readonly dragged: boolean;
  readonly isDraggable: boolean;
  hitTest(px: number, py: number): boolean;
}

export interface SkyPuff {
  x: number;
  y: number;
  age: number;
  radius: number;
}

export class PurplePlaneManager {
  state: PurplePlaneState = 'idle';
  x = 0;
  y = 0;
  heading = 0;
  propAngle = 0;
  animTime = 0;
  sparklePulse = 0;
  trail: SkyPuff[] = [];

  private lifeTimer = 0;
  private cooldownTimer = 0;
  private focusX = 0;
  private focusY = 0;
  private runAngle = 0;
  private lastPuffX = 0;
  private lastPuffY = 0;
  private marked = new Set<SkywriterTarget>();
  private screenWidth = 0;
  private screenHeight = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.focusX === 0 && this.focusY === 0) {
      this.focusX = width / 2;
      this.focusY = height / 2;
    }
    if (this.state === 'active') {
      const margin = this.size * 0.5;
      this.x = Math.max(margin, Math.min(width - margin, this.x));
      this.y = Math.max(margin, Math.min(height - margin, this.y));
    }
  }

  get size(): number {
    return Math.max(PURPLE_PLANE_MIN_SIZE, this.screenWidth * PURPLE_PLANE_SIZE_RATIO);
  }

  get overshoot(): number {
    return Math.max(140, Math.min(320, Math.min(this.screenWidth, this.screenHeight) * PURPLE_PLANE_OVERSHOOT_RATIO));
  }

  get markedCount(): number {
    return this.marked.size;
  }

  get buttonRadius(): number {
    return vehicleButtonRadius(this.screenWidth, this.screenHeight);
  }

  get buttonX(): number {
    return effectButtonX(this.screenWidth, this.screenHeight);
  }

  get buttonY(): number {
    return effectButtonY(5, this.screenWidth, this.screenHeight);
  }

  get alpha(): number {
    if (this.state !== 'active') return 0;
    return Math.max(0, Math.min(
      1,
      this.lifeTimer / 0.3,
      (PURPLE_PLANE_LIFETIME - this.lifeTimer) / PURPLE_PLANE_FADE_DURATION,
    ));
  }

  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / PURPLE_PLANE_COOLDOWN);
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
    this.lifeTimer = 0;
    this.trail = [];
    this.marked.clear();
    this.sparklePulse = 0;
    this.x = Math.min(this.screenWidth - this.size * 0.5, this.buttonX);
    this.y = this.buttonY;
    this.runAngle = Math.atan2(this.focusY - this.y, this.focusX - this.x);
    if (!Number.isFinite(this.runAngle)) this.runAngle = Math.PI;
    this.heading = this.runAngle;
    this.lastPuffX = this.x;
    this.lastPuffY = this.y;
  }

  update<T extends SkywriterTarget>(
    dt: number,
    focusX: number,
    focusY: number,
    targets: T[],
    onHit: (target: T) => void,
    onSparkle?: () => void,
  ): void {
    this.animTime += dt;
    this.propAngle += PURPLE_PLANE_PROP_SPEED * dt;
    this.sparklePulse = Math.max(0, this.sparklePulse - dt * 2.5);
    this.focusX = focusX;
    this.focusY = focusY;
    this.ageTrail(dt);

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= PURPLE_PLANE_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }
    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    const previousX = this.x;
    const previousY = this.y;
    const turned = this.fly(dt);
    this.addTrailPuffs(previousX, previousY, this.x, this.y);
    this.markCrossedTargets(previousX, previousY, this.x, this.y, targets);

    if (turned) {
      this.payoff(targets, onHit);
      this.sparklePulse = 1;
      onSparkle?.();
    }

    if (this.lifeTimer >= PURPLE_PLANE_LIFETIME) {
      this.state = 'cooldown';
      this.cooldownTimer = 0;
      this.marked.clear();
      this.trail = [];
    }
  }

  private fly(dt: number): boolean {
    const margin = this.size * 0.5;
    const waypointX = Math.max(margin, Math.min(
      this.screenWidth - margin,
      this.focusX + Math.cos(this.runAngle) * this.overshoot,
    ));
    const waypointY = Math.max(margin, Math.min(
      this.screenHeight - margin,
      this.focusY + Math.sin(this.runAngle) * this.overshoot,
    ));
    const desired = Math.atan2(waypointY - this.y, waypointX - this.x);
    this.heading = steer(this.heading, desired, PURPLE_PLANE_TURN_RATE * dt);
    this.x += Math.cos(this.heading) * PURPLE_PLANE_SPEED * dt;
    this.y += Math.sin(this.heading) * PURPLE_PLANE_SPEED * dt;
    this.x = Math.max(margin, Math.min(this.screenWidth - margin, this.x));
    this.y = Math.max(margin, Math.min(this.screenHeight - margin, this.y));

    const dx = waypointX - this.x;
    const dy = waypointY - this.y;
    if (dx * dx + dy * dy > PURPLE_PLANE_ARRIVE_RADIUS * PURPLE_PLANE_ARRIVE_RADIUS) return false;
    this.runAngle += Math.PI + 0.58;
    return true;
  }

  private addTrailPuffs(ax: number, ay: number, bx: number, by: number): void {
    const distance = Math.hypot(bx - this.lastPuffX, by - this.lastPuffY);
    if (distance < PURPLE_PLANE_TRAIL_SPACING) return;
    const segmentDistance = Math.hypot(bx - ax, by - ay) || 1;
    const count = Math.max(1, Math.floor(segmentDistance / PURPLE_PLANE_TRAIL_SPACING));
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count;
      this.trail.push({
        x: ax + (bx - ax) * t,
        y: ay + (by - ay) * t,
        age: 0,
        radius: this.size * (0.045 + (i % 3) * 0.008),
      });
    }
    this.lastPuffX = bx;
    this.lastPuffY = by;
  }

  private ageTrail(dt: number): void {
    for (const puff of this.trail) puff.age += dt;
    this.trail = this.trail.filter(puff => puff.age < PURPLE_PLANE_TRAIL_LIFETIME);
  }

  private markCrossedTargets<T extends SkywriterTarget>(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    targets: T[],
  ): void {
    if (this.marked.size >= PURPLE_PLANE_MARK_CAP) return;
    for (const target of targets) {
      if (this.marked.has(target) || !this.targetIsFree(target)) continue;
      const distance = segmentPointDistance(ax, ay, bx, by, target.x, target.y);
      const reach = Math.max(PURPLE_PLANE_MARK_RADIUS, Math.min(target.radiusX, target.radiusY));
      if (distance > reach) continue;
      this.marked.add(target);
      if (this.marked.size >= PURPLE_PLANE_MARK_CAP) return;
    }
  }

  private payoff<T extends SkywriterTarget>(targets: T[], onHit: (target: T) => void): void {
    for (const target of this.marked) {
      if (targets.includes(target as T) && this.targetIsFree(target)) onHit(target as T);
    }
    this.marked.clear();
  }

  private targetIsFree(target: SkywriterTarget): boolean {
    return !target.loaded && !target.dragged && target.isDraggable && target.hitTest(target.x, target.y);
  }

  clear(): void {
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.marked.clear();
    this.trail = [];
    this.sparklePulse = 0;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.y = 0;
    this.heading = 0;
    this.propAngle = 0;
    this.animTime = 0;
  }
}

function angleDiff(from: number, to: number): number {
  let difference = (to - from) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

function steer(current: number, target: number, maxStep: number): number {
  const difference = angleDiff(current, target);
  if (difference > maxStep) return current + maxStep;
  if (difference < -maxStep) return current - maxStep;
  return target;
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
