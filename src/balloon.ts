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
  POP_EXPAND_SCALE,
  POP_DURATION,
  PARTICLE_COUNT_MIN,
  PARTICLE_COUNT_MAX,
  PARTICLE_SPEED,
  PARTICLE_GRAVITY,
  PARTICLE_LIFETIME,
  PARTICLE_SIZE,
} from './constants';

export type BalloonState = 'floating' | 'squeezing' | 'popping' | 'dead';

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

  // Movement
  private baseX: number;
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

  constructor(screenWidth: number, screenHeight: number) {
    this.radiusX = (screenWidth * BALLOON_WIDTH_RATIO) / 2;
    this.radiusY = this.radiusX * BALLOON_ASPECT;

    // Random horizontal position, keeping balloon fully on screen
    const margin = this.radiusX + 10;
    this.x = margin + Math.random() * (screenWidth - margin * 2);
    this.baseX = this.x;

    // Start just below screen bottom
    this.y = screenHeight + this.radiusY;

    // Random float speed
    this.speed = FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN);

    // Random sway phase offset
    this.swayOffset = Math.random() * Math.PI * 2;

    // Number will be set externally
    this.number = 1;
  }

  get color(): string {
    return BALLOON_COLORS[this.number] || BALLOON_COLORS[1];
  }

  hitTest(px: number, py: number): boolean {
    if (this.state !== 'floating' && this.state !== 'squeezing') return false;
    // Ellipse hit test: ((px-cx)/rx)^2 + ((py-cy)/ry)^2 <= 1
    const dx = (px - this.x) / this.radiusX;
    const dy = (py - this.y) / this.radiusY;
    return dx * dx + dy * dy <= 1;
  }

  tap(): 'decremented' | 'popped' {
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
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = PARTICLE_SPEED * (0.6 + Math.random() * 0.4);
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        color: this.color,
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
    this.y -= this.speed * dt;
    this.swayTime += dt;
    this.x = this.baseX + Math.sin(this.swayTime * SWAY_FREQUENCY * Math.PI * 2 + this.swayOffset) * SWAY_AMPLITUDE;
    this.scaleX = 1;
    this.scaleY = 1;
  }

  private updateSqueeze(dt: number): void {
    // Also keep floating during squeeze
    this.y -= this.speed * dt;
    this.swayTime += dt;
    this.x = this.baseX + Math.sin(this.swayTime * SWAY_FREQUENCY * Math.PI * 2 + this.swayOffset) * SWAY_AMPLITUDE;

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
