import { Balloon } from './balloon';
import { Renderer } from './renderer';
import { AudioManager } from './audio';
import {
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_END,
  SPAWN_RAMP_DURATION,
  NUMBER_WEIGHTS,
  VIBRATE_DURATION,
  GAUGE_MAX,
  GAUGE_SPEED_MULTIPLIER,
  GAUGE_FLASH_DURATION,
} from './constants';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private audio: AudioManager;
  private balloons: Balloon[] = [];

  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  private lastTime: number = 0;
  private elapsed: number = 0;
  private spawnTimer: number = 0;
  private running: boolean = false;
  private rafId: number = 0;

  // Drag tracking: pointer id → drag state
  private drags: Map<number, { balloon: Balloon; startX: number; startY: number; moved: boolean }> = new Map();

  // Score & gauge
  private gaugeCount: number = 0;
  private level: number = 0;
  private speedMultiplier: number = 1;
  private gaugeFlashTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);
    this.audio = new AudioManager();
  }

  start(): void {
    this.handleResize();
    this.bindEvents();
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Cap dt to avoid spiral of death after tab switch
    if (dt > 0.1) dt = 0.1;

    this.elapsed += dt;
    this.update(dt);
    this.draw();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // Spawn logic
    this.spawnTimer += dt;
    const spawnInterval = this.getSpawnInterval();
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnBalloon();
    }

    // Update balloons
    for (const b of this.balloons) {
      b.update(dt);
    }

    // Remove off-screen and dead balloons
    this.balloons = this.balloons.filter(b => !b.isOffScreen() && !b.isDead());

    // Gauge flash countdown
    if (this.gaugeFlashTimer > 0) {
      this.gaugeFlashTimer = Math.max(0, this.gaugeFlashTimer - dt);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this.renderer.drawBackground(this.width, this.height);

    for (const b of this.balloons) {
      this.renderer.drawBalloon(b);
    }

    this.renderer.drawGauge(this.width, this.gaugeCount, this.level, this.gaugeFlashTimer);

    ctx.restore();
  }

  private getSpawnInterval(): number {
    const t = Math.min(this.elapsed / SPAWN_RAMP_DURATION, 1);
    const base = SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * t;
    return base / this.speedMultiplier;
  }

  private spawnBalloon(): void {
    const b = new Balloon(this.width, this.height, this.speedMultiplier);
    b.number = this.weightedRandomNumber();
    this.balloons.push(b);
  }

  private weightedRandomNumber(): number {
    const totalWeight = NUMBER_WEIGHTS.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * totalWeight;
    for (let i = 1; i < NUMBER_WEIGHTS.length; i++) {
      r -= NUMBER_WEIGHTS[i];
      if (r <= 0) return i;
    }
    return 1;
  }

  private static DRAG_THRESHOLD = 10; // px before a touch counts as drag vs tap

  private tapBalloon(b: Balloon): void {
    const result = b.tap();
    this.incrementGauge();
    if (result === 'decremented') {
      this.audio.playTap();
    } else {
      this.audio.playPop();
      if (navigator.vibrate) {
        navigator.vibrate(VIBRATE_DURATION);
      }
    }
  }

  private incrementGauge(): void {
    this.gaugeCount++;
    if (this.gaugeCount >= GAUGE_MAX) {
      this.gaugeCount = 0;
      this.level++;
      this.speedMultiplier *= GAUGE_SPEED_MULTIPLIER;
      this.gaugeFlashTimer = GAUGE_FLASH_DURATION;
    }
  }

  private findBalloon(x: number, y: number): Balloon | null {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      if (this.balloons[i].hitTest(x, y)) return this.balloons[i];
    }
    return null;
  }

  private handlePointerDown(id: number, x: number, y: number): void {
    const b = this.findBalloon(x, y);
    if (b) {
      b.dragged = true;
      this.drags.set(id, { balloon: b, startX: x, startY: y, moved: false });
    }
  }

  private handlePointerMove(id: number, x: number, y: number): void {
    const drag = this.drags.get(id);
    if (!drag) return;
    const dx = x - drag.startX;
    const dy = y - drag.startY;
    if (!drag.moved && dx * dx + dy * dy >= Game.DRAG_THRESHOLD * Game.DRAG_THRESHOLD) {
      drag.moved = true;
    }
    if (drag.moved) {
      drag.balloon.x = x;
      drag.balloon.y = y;
      drag.balloon.baseX = x;
    }
  }

  private handlePointerUp(id: number): void {
    const drag = this.drags.get(id);
    if (!drag) return;
    drag.balloon.dragged = false;
    if (!drag.moved) {
      this.tapBalloon(drag.balloon);
    }
    this.drags.delete(id);
  }

  private bindEvents(): void {
    // Touch events
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.handlePointerDown(t.identifier, t.clientX, t.clientY);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.handlePointerMove(t.identifier, t.clientX, t.clientY);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.handlePointerUp(e.changedTouches[i].identifier);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.handlePointerUp(e.changedTouches[i].identifier);
      }
    });

    // Mouse fallback for desktop (use id -1)
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.handlePointerDown(-1, e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.handlePointerMove(-1, e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.handlePointerUp(-1);
    });

    // Resize
    window.addEventListener('resize', () => this.handleResize());

    // Visibility change (pause/resume)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.running = false;
        cancelAnimationFrame(this.rafId);
        // Release all drags
        for (const [id, drag] of this.drags) {
          drag.balloon.dragged = false;
          this.drags.delete(id);
        }
      } else {
        this.running = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
      }
    });
  }

  private handleResize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
  }
}
