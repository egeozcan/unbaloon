import { Balloon } from './balloon';
import { Renderer } from './renderer';
import { AudioManager } from './audio';
import {
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_END,
  SPAWN_RAMP_DURATION,
  NUMBER_WEIGHTS,
  VIBRATE_DURATION,
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
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this.renderer.drawBackground(this.width, this.height);

    for (const b of this.balloons) {
      this.renderer.drawBalloon(b);
    }

    ctx.restore();
  }

  private getSpawnInterval(): number {
    const t = Math.min(this.elapsed / SPAWN_RAMP_DURATION, 1);
    return SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * t;
  }

  private spawnBalloon(): void {
    const b = new Balloon(this.width, this.height);
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

  private handleInput(x: number, y: number): void {
    // Iterate in reverse so topmost (last drawn) balloon is tapped first
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.hitTest(x, y)) {
        const result = b.tap();
        if (result === 'decremented') {
          this.audio.playTap();
        } else {
          this.audio.playPop();
          if (navigator.vibrate) {
            navigator.vibrate(VIBRATE_DURATION);
          }
        }
        break; // Only tap one balloon
      }
    }
  }

  private bindEvents(): void {
    // Touch events
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        this.handleInput(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Mouse fallback for desktop
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.handleInput(e.clientX, e.clientY);
    });

    // Resize
    window.addEventListener('resize', () => this.handleResize());

    // Visibility change (pause/resume)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.running = false;
        cancelAnimationFrame(this.rafId);
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
