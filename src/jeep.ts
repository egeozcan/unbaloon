import {
  JEEP_LIFETIME,
  JEEP_COOLDOWN,
  JEEP_FADE_DURATION,
  JEEP_SIZE_RATIO,
  JEEP_MIN_SIZE,
  JEEP_SPEED,
  JEEP_GROUND_LOCAL,
  JEEP_BODY_HALF_RATIO,
  JEEP_BUMPER_DX,
  JEEP_BUMPER_HEIGHT_RATIO,
  JEEP_BONK_NUDGE,
} from './constants';
import { effectButtonX, effectButtonY, vehicleButtonRadius } from './buttonLayout';

export type JeepState = 'idle' | 'active' | 'cooldown';

export interface JeepTarget {
  x: number;
  y: number;
  baseX: number;
  radiusX: number;
  radiusY: number;
  readonly loaded: boolean;
  readonly dragged: boolean;
  readonly isDraggable: boolean;
  hitTest(px: number, py: number): boolean;
}

export class JeepManager {
  state: JeepState = 'idle';
  x = 0;
  facing = -1;
  wheelPhase = 0;
  bonkPulse = 0;
  animTime = 0;

  private lifeTimer = 0;
  private cooldownTimer = 0;
  private grabbedBy: number | null = null;
  private grabDX = 0;
  private lastDragX = 0;
  private lastBumperX = 0;
  private lastBumperY = 0;
  private touching = new Set<JeepTarget>();
  private screenWidth = 0;
  private screenHeight = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.state === 'active') {
      this.x = this.clampX(this.x);
      this.lastBumperX = this.bumperX;
      this.lastBumperY = this.bumperY;
    }
  }

  get size(): number {
    return Math.max(JEEP_MIN_SIZE, this.screenWidth * JEEP_SIZE_RATIO);
  }

  get y(): number {
    return this.screenHeight - this.size * JEEP_GROUND_LOCAL;
  }

  get bumperX(): number {
    return this.x + this.facing * this.size * JEEP_BUMPER_DX;
  }

  get bumperY(): number {
    return this.y - this.size * JEEP_BUMPER_HEIGHT_RATIO;
  }

  get isGrabbed(): boolean {
    return this.grabbedBy !== null;
  }

  private get bodyHalf(): number {
    return this.size * JEEP_BODY_HALF_RATIO;
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
    return effectButtonY(2, this.screenWidth, this.screenHeight);
  }

  get alpha(): number {
    if (this.state !== 'active') return 0;
    const fadeIn = Math.min(1, this.lifeTimer / 0.3);
    const fadeOut = Math.min(1, (JEEP_LIFETIME - this.lifeTimer) / JEEP_FADE_DURATION);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  get cooldownProgress(): number {
    if (this.state !== 'cooldown') return 1;
    return Math.min(1, this.cooldownTimer / JEEP_COOLDOWN);
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
    this.grabbedBy = null;
    this.touching.clear();
    this.bonkPulse = 0;
    this.facing = -1;
    this.x = this.clampX(this.screenWidth - this.bodyHalf - 4);
    this.lastBumperX = this.bumperX;
    this.lastBumperY = this.bumperY;
  }

  tryGrab(id: number, px: number, py: number): boolean {
    if (this.state !== 'active' || this.grabbedBy !== null) return false;
    const dx = Math.abs(px - this.x);
    const dy = Math.abs(py - (this.y - this.size * 0.12));
    if (dx > this.size * 0.62 || dy > this.size * 0.48) return false;
    this.grabbedBy = id;
    this.grabDX = this.x - px;
    this.lastDragX = px;
    return true;
  }

  drag(id: number, px: number, _py: number): boolean {
    if (this.grabbedBy !== id) return false;
    const delta = px - this.lastDragX;
    if (Math.abs(delta) > 1) this.facing = delta >= 0 ? 1 : -1;
    const previous = this.x;
    this.x = this.clampX(px + this.grabDX);
    this.wheelPhase += (this.x - previous) * 0.1;
    this.lastDragX = px;
    return true;
  }

  release(id: number): boolean {
    if (this.grabbedBy !== id) return false;
    this.grabbedBy = null;
    return true;
  }

  releaseAll(): void {
    this.grabbedBy = null;
  }

  update<T extends JeepTarget>(dt: number, targets: T[], onBonk: (target: T) => void): void {
    this.animTime += dt;
    this.bonkPulse = Math.max(0, this.bonkPulse - dt * 6);

    if (this.state === 'cooldown') {
      this.cooldownTimer += dt;
      if (this.cooldownTimer >= JEEP_COOLDOWN) {
        this.state = 'idle';
        this.cooldownTimer = 0;
      }
      return;
    }
    if (this.state !== 'active') return;

    this.lifeTimer += dt;
    if (!this.isGrabbed) this.putter(dt);
    this.checkBonks(targets, onBonk, this.lastBumperX, this.lastBumperY);
    this.lastBumperX = this.bumperX;
    this.lastBumperY = this.bumperY;

    if (this.lifeTimer >= JEEP_LIFETIME) {
      this.releaseAll();
      this.touching.clear();
      this.state = 'cooldown';
      this.cooldownTimer = 0;
    }
  }

  private putter(dt: number): void {
    const previous = this.x;
    this.x = this.clampX(this.x + this.facing * JEEP_SPEED * dt);
    if (dt > 0 && (
      this.x === previous ||
      this.x <= this.bodyHalf + 0.5 ||
      this.x >= this.screenWidth - this.bodyHalf - 0.5
    )) {
      this.facing *= -1;
    }
    this.wheelPhase += (this.x - previous) * 0.1;
  }

  private checkBonks<T extends JeepTarget>(
    targets: T[],
    onBonk: (target: T) => void,
    previousBumperX: number,
    previousBumperY: number,
  ): void {
    const nowTouching = new Set<JeepTarget>();
    for (const target of targets) {
      if (target.loaded || target.dragged || !target.isDraggable) continue;
      if (!target.hitTest(target.x, target.y)) continue;
      const paddingX = target.radiusX + this.size * 0.12;
      const paddingY = target.radiusY + this.size * 0.16;
      const dx = Math.abs(target.x - this.bumperX);
      const dy = Math.abs(target.y - this.bumperY);
      const touching = dx <= paddingX && dy <= paddingY;
      if (touching) nowTouching.add(target);

      // A pointer can move the jeep much farther than one body length between RAF
      // frames. Sweep the old-to-new bumper segment so those quick passes still bonk.
      const swept = segmentPointDistance(
        previousBumperX / paddingX,
        previousBumperY / paddingY,
        this.bumperX / paddingX,
        this.bumperY / paddingY,
        target.x / paddingX,
        target.y / paddingY,
      ) <= 1;
      if (!swept || this.touching.has(target)) continue;

      onBonk(target);
      this.bonkPulse = 1;
      const next = Math.max(target.radiusX, Math.min(
        this.screenWidth - target.radiusX,
        target.baseX + this.facing * JEEP_BONK_NUDGE,
      ));
      target.baseX = next;
      target.x = next;
    }
    this.touching = nowTouching;
  }

  clear(): void {
    this.releaseAll();
    this.touching.clear();
    this.state = 'idle';
    this.lifeTimer = 0;
    this.cooldownTimer = 0;
    this.bonkPulse = 0;
  }

  reset(): void {
    this.clear();
    this.x = 0;
    this.animTime = 0;
    this.wheelPhase = 0;
    this.facing = -1;
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
