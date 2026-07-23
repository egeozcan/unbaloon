import { Balloon, SpecialType } from './balloon';
import { Renderer } from './renderer';
import { AudioManager } from './audio';
import { SessionManager, Phase } from './session';
import { SurpriseManager, SurpriseEventType } from './surprise';
import { HelicopterManager } from './helicopter';
import { PlaneManager } from './plane';
import { BulldozerManager } from './bulldozer';
import { TractorManager } from './tractor';
import { RainCloudManager } from './raincloud';
import { ExcavatorManager } from './excavator';
import { FiretruckManager } from './firetruck';
import { WheelLoaderManager } from './wheelloader';
import {
  NUMBER_WEIGHTS,
  VIBRATE_DURATION,
  SPECIAL_SPAWN_CHANCE,
  SPECIAL_SURPRISE_INCREMENT,
  FINALE_WAIT_TIMEOUT,
  FINALE_TAP_DELAY,
  FINALE_CELEBRATION_DURATION,
  FINALE_FADE_DURATION,
  MISSILE_DAMAGE,
} from './constants';

export class Game {
  private canvas: HTMLCanvasElement;
  private readonly onPlayAgain: () => void;
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

  // Session and surprise systems
  private session: SessionManager;
  private surprise: SurpriseManager;
  private helicopter: HelicopterManager;
  private plane: PlaneManager;
  private bulldozer: BulldozerManager;
  private tractor: TractorManager;
  private rainCloud: RainCloudManager;
  private excavator: ExcavatorManager;
  private firetruck: FiretruckManager;
  private wheelLoader: WheelLoaderManager;
  private previousPhase: Phase = 1;

  // Surprise counter
  private lastPopX: number = 0;
  private lastPopY: number = 0;

  // Focus point the plane strafes around: cursor on desktop, last tap on touch.
  private focusX: number = 0;
  private focusY: number = 0;

  // Finale state
  private finaleState: 'none' | 'waiting' | 'balloon' | 'celebrating' | 'fading' | 'done' = 'none';
  private finaleTimer: number = 0;
  private finaleSpawnTime: number = 0;

  constructor(canvas: HTMLCanvasElement, onPlayAgain: () => void = () => {}) {
    this.canvas = canvas;
    this.onPlayAgain = onPlayAgain;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);
    this.audio = new AudioManager();
    this.session = new SessionManager();
    this.surprise = new SurpriseManager();
    this.helicopter = new HelicopterManager();
    this.plane = new PlaneManager();
    this.bulldozer = new BulldozerManager();
    this.tractor = new TractorManager();
    this.rainCloud = new RainCloudManager();
    this.excavator = new ExcavatorManager();
    this.firetruck = new FiretruckManager();
    this.wheelLoader = new WheelLoaderManager();
  }

  start(): void {
    this.handleResize();
    this.surprise.setScreenSize(this.width, this.height);
    this.focusX = this.width / 2;
    this.focusY = this.height / 2;
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
    const phase = this.session.getPhase(this.elapsed);

    // Detect phase transition to finale
    if (phase === 4 && this.previousPhase !== 4) {
      this.enterFinale();
    }
    this.previousPhase = phase;

    // Handle finale states
    if (this.finaleState !== 'none') {
      this.updateFinale(dt);
    }

    // Spawn logic (only if not in finale)
    if (this.finaleState === 'none') {
      this.spawnTimer += dt;
      const spawnInterval = this.session.getSpawnInterval(this.elapsed);
      if (spawnInterval !== Infinity && this.spawnTimer >= spawnInterval) {
        this.spawnTimer -= spawnInterval;
        this.spawnBalloon();
      }
    }

    // Update balloons
    for (const b of this.balloons) {
      b.update(dt);
    }

    // Remove off-screen and dead balloons
    this.balloons = this.balloons.filter(b => !b.isOffScreen() && !b.isDead());

    // Balloons riding the tractor's trailer are committed to it — exclude them
    // from every other vehicle's targeting so nothing fights over a balloon.
    const freeBalloons = this.balloons.filter(b => !b.loaded);

    // Update helicopter: darts auto-target balloons and tap them (decrement, pop at 1)
    this.helicopter.update(
      dt,
      freeBalloons,
      (b) => this.tapBalloon(b),
      () => this.audio.playDartShoot(),
    );

    // Update plane: strafes around the focus point firing homing missiles that
    // destroy two balloon layers per hit.
    this.plane.update(
      dt,
      this.focusX,
      this.focusY,
      freeBalloons,
      (b) => this.missileHit(b),
      () => this.audio.playMissileLaunch(),
    );

    // Update bulldozer: drives behind the nearest balloon, shoves it to the
    // nearer side wall and crushes (taps) it in bites once it is pinned.
    this.bulldozer.update(
      dt,
      freeBalloons,
      (b) => this.crushBalloon(b),
    );

    // Update tractor: shuttles along the bottom towing a trailer, scooping up any
    // balloon that touches the bed and shedding a layer from each on a timer.
    this.tractor.update(
      dt,
      this.balloons,
      (b) => this.tapBalloon(b),
      () => this.audio.playTractorLoad(),
    );

    // Update rain cloud: wanders near the top and slows any balloon caught in its
    // downpour (it claims no balloon — slowed ones recover once they drift clear).
    this.rainCloud.update(dt, this.balloons);

    // Update excavator: an autonomous digger that trundles along the floor, drives
    // in under the nearest reachable balloon and chomps it with its bucket. It
    // claims the balloon it holds (via `loaded`), so it draws from the free pool.
    this.excavator.update(
      dt,
      freeBalloons,
      (b) => this.chompBalloon(b),
      () => this.audio.playExcavatorGrab(),
    );

    // Update fire truck: an autonomous truck that trundles along the floor, gets under
    // the nearest balloon and hoses an upward jet that slows every balloon caught in
    // the spray (it claims nothing — wet balloons recover once they drift clear).
    this.firetruck.update(dt, this.balloons);

    // Update wheel loader: a support vehicle that pops nothing — it trundles along the
    // floor and shoves low balloons horizontally under the nearest active popping
    // vehicle so those vehicles can finish them. Feed it the positions of whichever
    // poppers are currently out; with none out it simply idles.
    const poppers = [this.helicopter, this.plane, this.bulldozer, this.tractor, this.excavator]
      .filter(v => v.isActive)
      .map(v => ({ x: v.x, y: v.y }));
    this.wheelLoader.update(dt, freeBalloons, poppers);

    // Update surprise events
    this.surprise.update(dt);

    // Try to fire pending surprise event
    if (this.surprise.hasPendingEvent() && this.finaleState === 'none') {
      const windDown = phase === 3;
      const eventType = this.surprise.consumePendingEvent(this.lastPopX, this.lastPopY, windDown);
      if (eventType) {
        this.playSurpriseSound(eventType);
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this.renderer.drawBackground(this.width, this.height);

    // Surprise events below balloons (rainbow, confetti, starburst)
    const event = this.surprise.getActiveEvent();
    if (event) {
      this.renderer.drawSurpriseEventBelow(event, this.width, this.height);
    }

    for (const b of this.balloons) {
      this.renderer.drawBalloon(b);
    }

    // Bulldozer is a ground vehicle — it rides just above the balloons (so its
    // blade reads against the balloon it's shoving) but below the aircraft.
    this.renderer.drawBulldozer(this.bulldozer);

    // Tractor is a ground vehicle too — drawn over the balloons so its trailer
    // deck cradles the loaded ones, but below the aircraft.
    this.renderer.drawTractor(this.tractor);

    // Excavator is a ground vehicle as well — drawn over the balloons so its arm
    // and bucket read against the balloon it's gripping (alpha 0 when not out, so it
    // simply doesn't draw then).
    this.renderer.drawExcavator(this.excavator);

    // Fire truck is a ground vehicle too — drawn over the balloons so its water jet
    // reads against the balloons it is wetting (alpha 0 when not out).
    this.renderer.drawFiretruck(this.firetruck);

    // Wheel loader is a ground vehicle as well — drawn over the balloons so its bucket
    // reads against the balloon it is shoving (alpha 0 when not out).
    this.renderer.drawWheelLoader(this.wheelLoader);

    // Darts and helicopter ride above the balloons
    this.renderer.drawDarts(this.helicopter.darts);
    this.renderer.drawHelicopter(this.helicopter);

    // Missiles and plane ride above the balloons too
    this.renderer.drawMissiles(this.plane.missiles);
    this.renderer.drawPlane(this.plane);

    // Rain cloud weather sits in front of the play area — the downpour streaks
    // read clearly over the balloons it is slowing.
    this.renderer.drawRainCloud(this.rainCloud);

    // Surprise events above balloons (bubbles)
    if (event) {
      this.renderer.drawSurpriseEventAbove(event);
    }

    // Finale celebration events (multiple simultaneous)
    for (const fe of this.surprise.getFinaleEvents()) {
      this.renderer.drawSurpriseEventBelow(fe, this.width, this.height);
    }

    // Spawn buttons (UI) — hidden while their vehicle is out and during the
    // finale (when spawning is disabled). The plane button stacks below the heli.
    if (this.finaleState === 'none') {
      this.renderer.drawHelicopterButton(this.helicopter);
      this.renderer.drawPlaneButton(this.plane);
      this.renderer.drawBulldozerButton(this.bulldozer);
      this.renderer.drawTractorButton(this.tractor);
      this.renderer.drawExcavatorButton(this.excavator);
      this.renderer.drawFiretruckButton(this.firetruck);
      // Effect buttons live on the opposite (right) edge.
      this.renderer.drawRainCloudButton(this.rainCloud);
      this.renderer.drawWheelLoaderButton(this.wheelLoader);
    }

    // Finale fade overlay
    if (this.finaleState === 'fading') {
      const fadeAlpha = Math.min(1, this.finaleTimer / FINALE_FADE_DURATION);
      ctx.fillStyle = `rgba(135, 206, 235, ${fadeAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private spawnBalloon(): void {
    const speedMul = this.session.getSpeedMultiplier(this.elapsed);
    const sizeMul = this.session.getSizeMultiplier(this.elapsed);

    // Check for special balloon
    const hasSpecialOnScreen = this.balloons.some(b => b.specialType !== undefined);
    if (!hasSpecialOnScreen && Math.random() < SPECIAL_SPAWN_CHANCE) {
      const types: SpecialType[] = ['star', 'animal-cat', 'animal-frog', 'animal-bird', 'rainbow'];
      const type = types[Math.floor(Math.random() * types.length)];
      const b = Balloon.createSpecial(this.width, this.height, type);
      this.balloons.push(b);
      return;
    }

    const b = new Balloon(this.width, this.height, speedMul, sizeMul);
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
    const isSpecial = b.specialType !== undefined;
    const result = b.tap();

    // Balloon was already popping/dead (e.g. dart-popped mid-drag) — do nothing.
    if (result === 'ignored') return;

    this.lastPopX = b.x;
    this.lastPopY = b.y;

    // Increment surprise counter
    const increment = isSpecial ? SPECIAL_SURPRISE_INCREMENT : 1;
    this.surprise.incrementCounter(increment);

    if (result === 'decremented') {
      this.audio.playTap();
    } else {
      this.audio.playPop();
      if (isSpecial) {
        this.playSpecialPopSound(b);
      }
      if (navigator.vibrate) {
        navigator.vibrate(VIBRATE_DURATION);
      }
    }
  }

  // A homing missile destroys MISSILE_DAMAGE layers at once (e.g. a 4 → 2).
  // Reuses tapBalloon so surprise counting, sounds and vibration stay consistent;
  // once the balloon is popping the extra taps are harmlessly ignored.
  private missileHit(b: Balloon): void {
    for (let i = 0; i < MISSILE_DAMAGE; i++) {
      this.tapBalloon(b);
    }
  }

  // Each bulldozer crush "bite" taps the pinned balloon once (decrement, or pop
  // at 1). Reuses tapBalloon so surprise counting and pop sounds stay consistent,
  // layering a crunchy squish on top.
  private crushBalloon(b: Balloon): void {
    this.audio.playBulldozerCrush();
    this.tapBalloon(b);
  }

  // Each excavator bucket "chomp" taps the held balloon once (decrement, or pop at
  // 1). Reuses tapBalloon so surprise counting and pop sounds stay consistent,
  // layering a metallic bite on top.
  private chompBalloon(b: Balloon): void {
    this.audio.playExcavatorChomp();
    this.tapBalloon(b);
  }

  private findBalloon(x: number, y: number): Balloon | null {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      // Loaded balloons belong to the tractor — not grabbable or tappable.
      if (this.balloons[i].loaded) continue;
      if (this.balloons[i].hitTest(x, y)) return this.balloons[i];
    }
    return null;
  }

  private handlePointerDown(id: number, x: number, y: number): void {
    // Vehicle spawn buttons / dragging take priority (never during the finale)
    if (this.finaleState === 'none') {
      if (this.helicopter.trySpawn(x, y)) {
        this.audio.playHelicopterSpawn();
        return;
      }
      if (this.plane.trySpawn(x, y)) {
        this.audio.playPlaneSpawn();
        return;
      }
      if (this.bulldozer.trySpawn(x, y)) {
        this.audio.playBulldozerSpawn();
        return;
      }
      if (this.tractor.trySpawn(x, y)) {
        this.audio.playTractorSpawn();
        return;
      }
      if (this.excavator.trySpawn(x, y)) {
        this.audio.playExcavatorSpawn();
        return;
      }
      if (this.firetruck.trySpawn(x, y)) {
        this.audio.playFiretruckSpawn();
        return;
      }
      if (this.rainCloud.trySpawn(x, y)) {
        this.audio.playRainSpawn();
        return;
      }
      if (this.wheelLoader.trySpawn(x, y)) {
        this.audio.playWheelLoaderSpawn();
        return;
      }
      if (this.helicopter.tryGrab(id, x, y)) {
        return;
      }
    }

    // A tap in the play area becomes the plane's focus point.
    this.focusX = x;
    this.focusY = y;

    // Check bubbles first (non-consuming)
    const bubbleHit = this.surprise.bubbleHitTest(x, y);
    if (bubbleHit) {
      this.audio.playBubbleBloop();
    }

    const b = this.findBalloon(x, y);
    if (b) {
      // Finale balloon: check tap delay
      if (b.isFinale && this.elapsed - this.finaleSpawnTime < FINALE_TAP_DELAY) {
        return;
      }

      if (b.isDraggable) {
        b.dragged = true;
        this.drags.set(id, { balloon: b, startX: x, startY: y, moved: false });
      } else {
        // Special/finale balloons: tap immediately
        this.tapBalloon(b);

        // Handle finale balloon pop
        if (b.isFinale) {
          this.startFinaleCelebration(b);
        }
      }
    }
  }

  private handlePointerMove(id: number, x: number, y: number): void {
    // Desktop: the plane's focus follows the cursor continuously (mouse uses id
    // -1). Touch keeps the focus at the last tap (set in handlePointerDown), so
    // dragging a balloon or the helicopter doesn't drag the focus with it.
    if (id === -1) {
      this.focusX = x;
      this.focusY = y;
    }

    if (this.helicopter.drag(id, x, y)) return;

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
    if (this.helicopter.release(id)) return;

    const drag = this.drags.get(id);
    if (!drag) return;
    drag.balloon.dragged = false;
    if (!drag.moved) {
      this.tapBalloon(drag.balloon);
    } else if (this.tractor.tryDrop(drag.balloon)) {
      // Dropped onto the trailer — the tractor now carries it.
      this.audio.playTractorLoad();
    }
    this.drags.delete(id);
  }

  // ── Sound helpers ─────────────────────────────────────────────────────────

  private playSurpriseSound(type: SurpriseEventType): void {
    const event = this.surprise.getActiveEvent();
    switch (type) {
      case 'rainbow': this.audio.playRainbowWhoosh(); break;
      case 'confetti': this.audio.playConfettiPatter(); break;
      case 'starburst': this.audio.playStarSparkle(); break;
      case 'silly':
        if (event?.sillySound) {
          switch (event.sillySound) {
            case 'quack': this.audio.playQuack(); break;
            case 'boing': this.audio.playBoing(); break;
            case 'slideWhistle': this.audio.playSlideWhistle(); break;
            case 'giggle': this.audio.playGiggle(); break;
          }
        }
        break;
    }
  }

  private playSpecialPopSound(b: Balloon): void {
    switch (b.specialType) {
      case 'star': this.audio.playStarChime(); break;
      case 'animal-cat': this.audio.playMeow(); break;
      case 'animal-frog': this.audio.playRibbit(); break;
      case 'animal-bird': this.audio.playTweet(); break;
      case 'rainbow': this.audio.playRainbowHarp(); break;
    }
  }

  // ── Finale logic ──────────────────────────────────────────────────────────

  private enterFinale(): void {
    this.finaleState = 'waiting';
    this.finaleTimer = 0;
    // Force-release all drags
    for (const [, drag] of this.drags) {
      drag.balloon.dragged = false;
    }
    this.drags.clear();
    // Remove the helicopter, plane, bulldozer and tractor (and their projectiles)
    // for the finale; clearing the bulldozer/tractor also releases any balloon
    // they were holding.
    this.helicopter.clear();
    this.plane.clear();
    this.bulldozer.clear();
    this.tractor.clear();
    this.rainCloud.clear();
    this.excavator.clear();
    this.firetruck.clear();
    this.wheelLoader.clear();
  }

  private updateFinale(dt: number): void {
    this.finaleTimer += dt;

    switch (this.finaleState) {
      case 'waiting':
        if (this.balloons.length === 0 || this.finaleTimer >= FINALE_WAIT_TIMEOUT) {
          this.balloons = [];
          this.spawnFinaleBalloon();
          this.finaleState = 'balloon';
        }
        break;
      case 'balloon':
        // Waiting for player to pop — handled in handlePointerDown
        break;
      case 'celebrating':
        if (this.finaleTimer >= FINALE_CELEBRATION_DURATION) {
          this.finaleState = 'fading';
          this.finaleTimer = 0;
        }
        break;
      case 'fading':
        if (this.finaleTimer >= FINALE_FADE_DURATION) {
          this.finaleState = 'done';
          this.showPlayAgain();
        }
        break;
    }
  }

  private spawnFinaleBalloon(): void {
    const b = Balloon.createFinale(this.width, this.height);
    this.balloons.push(b);
    this.finaleSpawnTime = this.elapsed;
  }

  private startFinaleCelebration(b: Balloon): void {
    this.lastPopX = b.x;
    this.lastPopY = b.y;
    this.audio.playFinaleCelebration();
    this.surprise.forceFinaleEvents(b.x, b.y);
    this.finaleState = 'celebrating';
    this.finaleTimer = 0;
  }

  // ── Play again / reset ────────────────────────────────────────────────────

  private showPlayAgain(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.onPlayAgain();
  }

  reset(): void {
    this.balloons = [];
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.previousPhase = 1;
    this.finaleState = 'none';
    this.finaleTimer = 0;
    this.finaleSpawnTime = 0;
    this.lastPopX = 0;
    this.lastPopY = 0;
    this.surprise.reset();
    this.surprise.setScreenSize(this.width, this.height);
    this.helicopter.reset();
    this.helicopter.setScreenSize(this.width, this.height);
    this.plane.reset();
    this.plane.setScreenSize(this.width, this.height);
    this.bulldozer.reset();
    this.bulldozer.setScreenSize(this.width, this.height);
    this.tractor.reset();
    this.tractor.setScreenSize(this.width, this.height);
    this.rainCloud.reset();
    this.rainCloud.setScreenSize(this.width, this.height);
    this.excavator.reset();
    this.excavator.setScreenSize(this.width, this.height);
    this.firetruck.reset();
    this.firetruck.setScreenSize(this.width, this.height);
    this.wheelLoader.reset();
    this.wheelLoader.setScreenSize(this.width, this.height);
    this.focusX = this.width / 2;
    this.focusY = this.height / 2;
    this.session.reset();
    for (const [, drag] of this.drags) {
      drag.balloon.dragged = false;
    }
    this.drags.clear();

    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  // ── Event binding ─────────────────────────────────────────────────────────

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
        this.helicopter.releaseAll();
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
    this.surprise.setScreenSize(this.width, this.height);
    this.helicopter.setScreenSize(this.width, this.height);
    this.plane.setScreenSize(this.width, this.height);
    this.bulldozer.setScreenSize(this.width, this.height);
    this.tractor.setScreenSize(this.width, this.height);
    this.rainCloud.setScreenSize(this.width, this.height);
    this.excavator.setScreenSize(this.width, this.height);
    this.firetruck.setScreenSize(this.width, this.height);
    this.wheelLoader.setScreenSize(this.width, this.height);
  }
}
