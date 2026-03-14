import {
  SURPRISE_COUNTER_MIN,
  SURPRISE_COUNTER_MAX,
  BUBBLE_COUNT_MIN,
  BUBBLE_COUNT_MAX,
  BUBBLE_RADIUS,
  BUBBLE_DURATION,
  RAINBOW_DURATION,
  CONFETTI_DURATION,
  STARBURST_DURATION,
  CONFETTI_COUNT,
  CONFETTI_WIDTH,
  CONFETTI_HEIGHT,
  STARBURST_COUNT_MIN,
  STARBURST_COUNT_MAX,
  STARBURST_STAR_SIZE,
  WIND_DOWN_GENTLE_WEIGHT,
} from './constants';

export type SurpriseEventType = 'rainbow' | 'confetti' | 'starburst' | 'bubbles' | 'silly';
export type SillySound = 'quack' | 'boing' | 'slideWhistle' | 'giggle';

const ALL_EVENTS: SurpriseEventType[] = ['rainbow', 'confetti', 'starburst', 'bubbles', 'silly'];
const GENTLE_EVENTS: SurpriseEventType[] = ['starburst', 'bubbles'];
const OTHER_EVENTS: SurpriseEventType[] = ['rainbow', 'confetti', 'silly'];
const ALL_SILLY: SillySound[] = ['quack', 'boing', 'slideWhistle', 'giggle'];

export interface Bubble {
  x: number; y: number; vy: number; radius: number;
  age: number; popped: boolean; popAge: number;
}

export interface ConfettiPiece {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number; color: string; age: number;
}

export interface StarBurstStar {
  x: number; y: number; vx: number; vy: number;
  age: number; size: number;
}

export interface ActiveEvent {
  type: SurpriseEventType;
  age: number;
  duration: number;
  sillySound?: SillySound;
  direction?: number;
  originX?: number;
  originY?: number;
  stars?: StarBurstStar[];
  confetti?: ConfettiPiece[];
  bubbles?: Bubble[];
}

const CONFETTI_COLORS = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF', '#FF69B4'];

export class SurpriseManager {
  private counter: number = 0;
  private threshold: number;
  private lastEventType: SurpriseEventType | null = null;
  private lastSillySound: SillySound | null = null;
  private pending: boolean = false;
  private activeEvent: ActiveEvent | null = null;
  private finaleEvents: ActiveEvent[] = [];
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  constructor() {
    this.threshold = this.randomThreshold();
  }

  private randomThreshold(): number {
    return SURPRISE_COUNTER_MIN + Math.floor(Math.random() * (SURPRISE_COUNTER_MAX - SURPRISE_COUNTER_MIN + 1));
  }

  incrementCounter(amount: number): void {
    if (this.pending) return;
    this.counter += amount;
    if (this.counter >= this.threshold) {
      this.pending = true;
      this.counter = 0;
      this.threshold = this.randomThreshold();
    }
  }

  hasPendingEvent(): boolean {
    return this.pending;
  }

  consumePendingEvent(lastPopX: number, lastPopY: number, windDown: boolean = false): SurpriseEventType | null {
    if (!this.pending) return null;
    if (this.activeEvent) return null;
    this.pending = false;
    const type = this.pickEvent(windDown);
    this.lastEventType = type;
    this.activeEvent = this.createEvent(type, lastPopX, lastPopY);
    return type;
  }

  private pickEvent(windDown: boolean): SurpriseEventType {
    let pool: SurpriseEventType[];
    if (windDown) {
      if (Math.random() < WIND_DOWN_GENTLE_WEIGHT) {
        pool = GENTLE_EVENTS.filter(e => e !== this.lastEventType);
        if (pool.length === 0) pool = OTHER_EVENTS;
      } else {
        pool = OTHER_EVENTS.filter(e => e !== this.lastEventType);
        if (pool.length === 0) pool = GENTLE_EVENTS;
      }
    } else {
      pool = ALL_EVENTS.filter(e => e !== this.lastEventType);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickSillySound(): SillySound {
    const pool = ALL_SILLY.filter(s => s !== this.lastSillySound);
    const sound = pool[Math.floor(Math.random() * pool.length)];
    this.lastSillySound = sound;
    return sound;
  }

  private createEvent(type: SurpriseEventType, originX: number, originY: number): ActiveEvent {
    switch (type) {
      case 'rainbow':
        return { type, age: 0, duration: RAINBOW_DURATION, direction: Math.random() < 0.5 ? 1 : -1 };
      case 'confetti':
        return { type, age: 0, duration: CONFETTI_DURATION, confetti: this.spawnConfetti() };
      case 'starburst':
        return { type, age: 0, duration: STARBURST_DURATION, originX, originY, stars: this.spawnStarBurst(originX, originY) };
      case 'bubbles':
        return { type, age: 0, duration: BUBBLE_DURATION, bubbles: this.spawnBubbles() };
      case 'silly':
        return { type, age: 0, duration: 0.5, sillySound: this.pickSillySound() };
    }
  }

  private spawnConfetti(): ConfettiPiece[] {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      pieces.push({
        x: Math.random() * this.screenWidth,
        y: -CONFETTI_HEIGHT - Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 60,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        age: 0,
      });
    }
    return pieces;
  }

  private spawnStarBurst(originX: number, originY: number): StarBurstStar[] {
    const count = STARBURST_COUNT_MIN + Math.floor(Math.random() * (STARBURST_COUNT_MAX - STARBURST_COUNT_MIN + 1));
    const stars: StarBurstStar[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 80 + Math.random() * 60;
      stars.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, size: STARBURST_STAR_SIZE * (0.7 + Math.random() * 0.6),
      });
    }
    return stars;
  }

  private spawnBubbles(): Bubble[] {
    const count = BUBBLE_COUNT_MIN + Math.floor(Math.random() * (BUBBLE_COUNT_MAX - BUBBLE_COUNT_MIN + 1));
    const bubbles: Bubble[] = [];
    for (let i = 0; i < count; i++) {
      bubbles.push({
        x: Math.random() * this.screenWidth,
        y: this.screenHeight + BUBBLE_RADIUS + Math.random() * 60,
        vy: -(40 + Math.random() * 40),
        radius: BUBBLE_RADIUS * (0.7 + Math.random() * 0.6),
        age: 0, popped: false, popAge: 0,
      });
    }
    return bubbles;
  }

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  update(dt: number): void {
    if (this.activeEvent) {
      this.activeEvent.age += dt;
      switch (this.activeEvent.type) {
        case 'confetti':
          if (this.activeEvent.confetti) {
            for (const c of this.activeEvent.confetti) {
              c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rotation += c.rotationSpeed * dt;
            }
          }
          break;
        case 'starburst':
          if (this.activeEvent.stars) {
            for (const s of this.activeEvent.stars) {
              s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
            }
          }
          break;
        case 'bubbles':
          if (this.activeEvent.bubbles) {
            for (const b of this.activeEvent.bubbles) {
              b.age += dt;
              if (b.popped) { b.popAge += dt; } else { b.y += b.vy * dt; }
            }
          }
          break;
      }
      if (this.activeEvent.age >= this.activeEvent.duration) {
        this.activeEvent = null;
      }
    }

    // Update finale events (multiple simultaneous)
    for (const fe of this.finaleEvents) {
      fe.age += dt;
      if (fe.type === 'confetti' && fe.confetti) {
        for (const c of fe.confetti) { c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rotation += c.rotationSpeed * dt; }
      }
      if (fe.type === 'starburst' && fe.stars) {
        for (const s of fe.stars) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      }
    }
    this.finaleEvents = this.finaleEvents.filter(fe => fe.age < fe.duration);
  }

  bubbleHitTest(x: number, y: number): boolean {
    if (!this.activeEvent || this.activeEvent.type !== 'bubbles' || !this.activeEvent.bubbles) return false;
    for (const b of this.activeEvent.bubbles) {
      if (b.popped) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) {
        b.popped = true; b.popAge = 0;
        return true;
      }
    }
    return false;
  }

  getActiveEvent(): ActiveEvent | null {
    return this.activeEvent;
  }

  getFinaleEvents(): ActiveEvent[] {
    return this.finaleEvents;
  }

  forceFinaleEvents(originX: number, originY: number): void {
    this.activeEvent = null;
    this.finaleEvents = [
      this.createEvent('rainbow', originX, originY),
      this.createEvent('confetti', originX, originY),
      this.createEvent('starburst', originX, originY),
    ];
  }

  reset(): void {
    this.counter = 0;
    this.pending = false;
    this.activeEvent = null;
    this.finaleEvents = [];
    this.lastEventType = null;
    this.lastSillySound = null;
    this.threshold = this.randomThreshold();
  }
}
