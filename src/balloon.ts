import {
  BALLOON_COLORS,
  BALLOON_WIDTH_RATIO,
  BALLOON_ASPECT,
  FLOAT_SPEED_MIN,
  FLOAT_SPEED_MAX,
  SWAY_AMPLITUDE,
  SWAY_FREQUENCY,
  SQUEEZE_SCALE_X,
  SQUEEZE_SCALE_Y,
  SQUEEZE_DURATION,
  POP_DURATION,
  PARTICLE_COUNT_MIN,
  PARTICLE_COUNT_MAX,
  PARTICLE_SPEED,
  PARTICLE_GRAVITY,
  PARTICLE_LIFETIME,
  PARTICLE_SIZE,
  SPECIAL_SPEED_MULTIPLIER,
  SPECIAL_RAINBOW_SIZE_MULTIPLIER,
  FINALE_BALLOON_SIZE_MULTIPLIER,
  FINALE_BALLOON_SPEED,
  SPECIAL_STAR_COLOR,
  SPECIAL_CAT_COLOR,
  SPECIAL_FROG_COLOR,
  SPECIAL_BIRD_COLOR,
} from './constants';

export type BalloonState = 'floating' | 'squeezing' | 'popping' | 'dead';

export type SpecialType = 'star' | 'animal-cat' | 'animal-frog' | 'animal-bird' | 'rainbow';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  color: string;
  radius: number;
}

export class Balloon {
  x: number;
  y: number;
  number: number;
  state: BalloonState = 'floating';

  // Computed sizes
  radiusX: number;
  radiusY: number;

  // Dragging
  dragged: boolean = false;

  // Special type / finale
  specialType?: SpecialType;
  isFinale: boolean = false;
  animTime: number = 0;
  private screenHeight: number = 0;

  // Movement
  baseX: number;
  private speed: number;
  private swayOffset: number;
  private swayTime: number = 0;

  // Squeeze animation
  scaleX: number = 1;
  scaleY: number = 1;
  private squeezeTimer: number = 0;

  // Pop animation
  popProgress: number = 0;
  particles: Particle[] = [];

  constructor(screenWidth: number, screenHeight: number, speedMultiplier: number = 1, sizeMultiplier: number = 1) {
    this.radiusX = (screenWidth * BALLOON_WIDTH_RATIO * sizeMultiplier) / 2;
    this.radiusY = this.radiusX * BALLOON_ASPECT;

    // Random horizontal position, keeping balloon fully on screen
    const margin = this.radiusX + 10;
    this.x = margin + Math.random() * (screenWidth - margin * 2);
    this.baseX = this.x;

    // Start just below screen bottom
    this.y = screenHeight + this.radiusY;

    // Random float speed
    this.speed = (FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN)) * speedMultiplier;

    // Random sway phase offset
    this.swayOffset = Math.random() * Math.PI * 2;

    // Number will be set externally
    this.number = 1;

    this.screenHeight = screenHeight;
  }

  static createSpecial(screenWidth: number, screenHeight: number, type: SpecialType): Balloon {
    const speedMul = SPECIAL_SPEED_MULTIPLIER;
    const sizeMul = type === 'rainbow' ? SPECIAL_RAINBOW_SIZE_MULTIPLIER : 1;
    const b = new Balloon(screenWidth, screenHeight, speedMul, sizeMul);
    b.specialType = type;
    b.number = 1;
    return b;
  }

  static createFinale(screenWidth: number, screenHeight: number): Balloon {
    const b = new Balloon(screenWidth, screenHeight, 1, FINALE_BALLOON_SIZE_MULTIPLIER);
    b.isFinale = true;
    b.number = 1;
    b.x = screenWidth / 2;
    b.baseX = screenWidth / 2;
    b.speed = FINALE_BALLOON_SPEED;
    return b;
  }

  get color(): string {
    if (this.specialType) {
      switch (this.specialType) {
        case 'star': return SPECIAL_STAR_COLOR;
        case 'animal-cat': return SPECIAL_CAT_COLOR;
        case 'animal-frog': return SPECIAL_FROG_COLOR;
        case 'animal-bird': return SPECIAL_BIRD_COLOR;
        case 'rainbow': return '#FF4444';
      }
    }
    return BALLOON_COLORS[this.number] || BALLOON_COLORS[1];
  }

  get isDraggable(): boolean {
    return !this.specialType && !this.isFinale;
  }

  hitTest(px: number, py: number): boolean {
    if (this.state !== 'floating' && this.state !== 'squeezing') return false;
    // Ellipse hit test: ((px-cx)/rx)^2 + ((py-cy)/ry)^2 <= 1
    const dx = (px - this.x) / this.radiusX;
    const dy = (py - this.y) / this.radiusY;
    return dx * dx + dy * dy <= 1;
  }

  tap(): 'decremented' | 'popped' | 'ignored' {
    // Ignore taps on balloons that are already popping or dead (e.g. a balloon a
    // dart popped while it was still being dragged).
    if (this.state !== 'floating' && this.state !== 'squeezing') return 'ignored';
    if (this.number > 1) {
      this.number--;
      // Trigger squeeze animation
      this.state = 'squeezing';
      this.squeezeTimer = 0;
      return 'decremented';
    } else {
      // Pop!
      this.state = 'popping';
      this.popProgress = 0;
      this.spawnParticles();
      return 'popped';
    }
  }

  private spawnParticles(): void {
    const count = PARTICLE_COUNT_MIN +
      Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1));
    const rainbowColors = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = PARTICLE_SPEED * (0.6 + Math.random() * 0.4);
      const color = this.specialType === 'rainbow' || this.isFinale
        ? rainbowColors[i % rainbowColors.length]
        : this.color;
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        color,
        radius: PARTICLE_SIZE * (0.7 + Math.random() * 0.6),
      });
    }
  }

  update(dt: number): void {
    switch (this.state) {
      case 'floating':
        this.updateFloating(dt);
        break;
      case 'squeezing':
        this.updateSqueeze(dt);
        break;
      case 'popping':
        this.updatePop(dt);
        break;
    }
  }

  private updateFloating(dt: number): void {
    if (!this.dragged) {
      if (this.isFinale && this.y <= this.screenHeight / 2) {
        this.y = this.screenHeight / 2;
      } else {
        this.y -= this.speed * dt;
      }
      this.swayTime += dt;
      this.x = this.baseX + Math.sin(this.swayTime * SWAY_FREQUENCY * Math.PI * 2 + this.swayOffset) * SWAY_AMPLITUDE;
    }
    this.scaleX = 1;
    this.scaleY = 1;
    this.animTime += dt;
  }

  private updateSqueeze(dt: number): void {
    // Also keep floating during squeeze (unless dragged)
    if (!this.dragged) {
      this.y -= this.speed * dt;
      this.swayTime += dt;
      this.x = this.baseX + Math.sin(this.swayTime * SWAY_FREQUENCY * Math.PI * 2 + this.swayOffset) * SWAY_AMPLITUDE;
    }

    this.squeezeTimer += dt;
    const t = Math.min(this.squeezeTimer / SQUEEZE_DURATION, 1);

    if (t < 0.5) {
      // First half: squeeze in
      const p = t * 2; // 0→1
      this.scaleX = 1 + (SQUEEZE_SCALE_X - 1) * p;
      this.scaleY = 1 + (SQUEEZE_SCALE_Y - 1) * p;
    } else {
      // Second half: bounce back
      const p = (t - 0.5) * 2; // 0→1
      this.scaleX = SQUEEZE_SCALE_X + (1 - SQUEEZE_SCALE_X) * p;
      this.scaleY = SQUEEZE_SCALE_Y + (1 - SQUEEZE_SCALE_Y) * p;
    }

    if (t >= 1) {
      this.state = 'floating';
      this.scaleX = 1;
      this.scaleY = 1;
    }
  }

  private updatePop(dt: number): void {
    this.popProgress += dt / POP_DURATION;

    // Update particles
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.vy += PARTICLE_GRAVITY * dt;
      p.y += p.vy * dt;
    }

    if (this.popProgress >= 1 && this.particles.every(p => p.age >= PARTICLE_LIFETIME)) {
      this.state = 'dead';
    }
  }

  isOffScreen(): boolean {
    return this.state === 'floating' && this.y < -this.radiusY * 2;
  }

  isDead(): boolean {
    return this.state === 'dead';
  }
}
