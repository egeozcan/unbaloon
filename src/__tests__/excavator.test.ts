import { describe, it, expect } from 'vitest';
import { ExcavatorManager, GrabTarget } from '../excavator';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { BulldozerManager } from '../bulldozer';
import { TractorManager } from '../tractor';
import { FiretruckManager } from '../firetruck';
import { Balloon } from '../balloon';
import {
  EXCAVATOR_LIFETIME,
  EXCAVATOR_COOLDOWN,
} from '../constants';

// Lightweight stand-in for a balloon the excavator can grab and chomp. Mirrors the
// writable fields the manager mutates; `chomp()` decrements layers like Balloon.tap.
class FakeTarget implements GrabTarget {
  baseX: number;
  loaded = false;
  dragged = false;
  isDraggable = true;
  constructor(
    public x: number,
    public y: number,
    public layers = 1,
    public radiusX = 56,
    public radiusY = 70,
    public alive = true,
  ) {
    this.baseX = x;
  }
  hitTest(px: number, py: number): boolean {
    if (!this.alive) return false;
    const dx = (px - this.x) / this.radiusX;
    const dy = (py - this.y) / this.radiusY;
    return dx * dx + dy * dy <= 1;
  }
  chomp(): void {
    this.layers -= 1;
    if (this.layers <= 0) this.alive = false;
  }
}

function make(w = 800, h = 600): ExcavatorManager {
  const ex = new ExcavatorManager();
  ex.setScreenSize(w, h);
  return ex;
}

const noop = () => {};

// Run the manager until `done` returns true or the frame cap is hit. Steady 1/60s.
function run(
  ex: ExcavatorManager,
  balloons: GrabTarget[],
  onChomp: (b: GrabTarget) => void,
  done: () => boolean,
  maxFrames = 2000,
): number {
  let f = 0;
  for (; f < maxFrames; f++) {
    ex.update(1 / 60, balloons, onChomp);
    if (done()) break;
  }
  return f;
}

describe('ExcavatorManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const ex = make();
      expect(ex.state).toBe('idle');
      expect(ex.isAvailable).toBe(true);
      expect(ex.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const ex = make();
      expect(ex.trySpawn(ex.buttonX, ex.buttonY)).toBe(true);
      expect(ex.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const ex = make();
      expect(ex.trySpawn(600, 400)).toBe(false);
      expect(ex.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const ex = make();
      ex.spawn();
      expect(ex.trySpawn(ex.buttonX, ex.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const ex = make();
      ex.spawn();
      ex.update(EXCAVATOR_LIFETIME + 0.1, [], noop);
      expect(ex.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const ex = make();
      ex.spawn();
      ex.update(EXCAVATOR_LIFETIME + 0.1, [], noop);
      expect(ex.isAvailable).toBe(false);
      expect(ex.trySpawn(ex.buttonX, ex.buttonY)).toBe(false);
      ex.update(EXCAVATOR_COOLDOWN + 0.1, [], noop);
      expect(ex.state).toBe('idle');
      expect(ex.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const ex = make();
      ex.spawn();
      ex.update(EXCAVATOR_LIFETIME + 0.01, [], noop); // -> cooldown
      const start = ex.cooldownProgress;
      ex.update(EXCAVATOR_COOLDOWN / 2, [], noop);
      const mid = ex.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });

    it('fades in on spawn and out at end of life', () => {
      const ex = make();
      ex.spawn();
      expect(ex.alpha).toBe(0);                       // nothing elapsed yet
      ex.update(0.3, [], noop);
      expect(ex.alpha).toBeCloseTo(1, 1);             // faded in
      ex.update(EXCAVATOR_LIFETIME - 0.3 - 0.6, [], noop); // near the end
      expect(ex.alpha).toBeLessThan(1);               // fading out
      expect(ex.alpha).toBeGreaterThan(0);
    });
  });

  describe('spawn button placement (5th in the left column)', () => {
    it('stacks below the tractor button, sharing the left edge', () => {
      const ex = make();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      const tractor = new TractorManager();
      tractor.setScreenSize(800, 600);
      expect(ex.buttonX).toBe(tractor.buttonX);
      expect(ex.buttonX).toBe(heli.buttonX);
      expect(ex.buttonY).toBeGreaterThan(tractor.buttonY);
    });

    it('keeps all button touch targets from overlapping on any screen', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [480, 300]]) {
        const buttons = makeAllButtons(w, h);
        for (let i = 0; i < buttons.length; i++) {
          for (let j = i + 1; j < buttons.length; j++) {
            const a = buttons[i];
            const b = buttons[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            expect(dist).toBeGreaterThanOrEqual((a.r + b.r) * 1.25);
          }
        }
      }
    });

    it('keeps all buttons fully on-screen, including short/landscape viewports', () => {
      for (const [w, h] of [[667, 375], [568, 320], [812, 375], [844, 390], [375, 667], [320, 480], [480, 300], [400, 300]]) {
        for (const btn of makeAllButtons(w, h)) {
          const reach = btn.r * 1.25; // touch target must stay within the viewport
          expect(btn.y - reach).toBeGreaterThanOrEqual(0);
          expect(btn.y + reach).toBeLessThanOrEqual(h);
          expect(btn.x - reach).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('movement', () => {
    it('rides at a fixed height near the bottom of the screen', () => {
      const ex = make();
      ex.spawn();
      const y0 = ex.y;
      for (let i = 0; i < 120; i++) ex.update(1 / 60, [], noop);
      expect(ex.y).toBe(y0);
      expect(ex.y).toBeGreaterThan(600 * 0.7);
      expect(ex.y).toBeLessThan(600);
    });

    it('trundles toward a balloon off to the side to get under it', () => {
      const ex = make();
      ex.spawn();
      const x0 = ex.x;                       // spawns near centre
      const b = new FakeTarget(700, 300, 99); // off to the right, reachable height
      for (let i = 0; i < 60; i++) ex.update(1 / 60, [b], noop);
      expect(ex.x).toBeGreaterThan(x0 + 20); // drove right toward it
      const half = ex.size * 0.46;
      expect(ex.x + half).toBeLessThanOrEqual(800 + 1); // stays on-screen
    });
  });

  describe('articulated arm (inverse kinematics)', () => {
    it('preserves the boom and stick lengths as the arm settles', () => {
      const ex = make();
      ex.spawn();
      for (let i = 0; i < 90; i++) ex.update(1 / 60, [], noop); // ease to the rest pose
      const boom = Math.hypot(ex.elbowX - ex.shoulderX, ex.elbowY - ex.shoulderY);
      const stick = Math.hypot(ex.bucketX - ex.elbowX, ex.bucketY - ex.elbowY);
      expect(boom).toBeCloseTo(ex.boomLen, 3);
      expect(stick).toBeCloseTo(ex.stickLen, 3);
    });

    it('bends the elbow upward (boom rises, stick descends to the bucket)', () => {
      const ex = make();
      ex.spawn();
      for (let i = 0; i < 90; i++) ex.update(1 / 60, [], noop);
      expect(ex.elbowY).toBeLessThan(ex.shoulderY);
    });
  });

  describe('grabbing and chomping balloons', () => {
    it('reaches up, grabs a balloon overhead and pops it', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 1); // directly overhead, in reach
      let chomps = 0;
      run(ex, [b], (t) => { chomps++; (t as FakeTarget).chomp(); }, () => !b.alive, 600);
      expect(b.alive).toBe(false);
      expect(chomps).toBeGreaterThanOrEqual(1);
      expect(b.loaded).toBe(false); // released once popped
    });

    it('claims a held balloon (loaded) and carries it on the bucket', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 99);
      run(ex, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.update(1 / 60, [b], (t) => (t as FakeTarget).chomp());
      expect(b.x).toBeCloseTo(ex.bucketX, 5);
    });

    it('sheds a layer per chomp until a multi-layer balloon pops', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 4);
      let chomps = 0;
      run(ex, [b], (t) => { chomps++; (t as FakeTarget).chomp(); }, () => !b.alive, 900);
      expect(chomps).toBeGreaterThanOrEqual(4);
      expect(b.alive).toBe(false);
    });

    it('fully pops a real multi-layer Balloon overhead', () => {
      const ex = make();
      ex.spawn();
      const b = new Balloon(800, 600);
      b.number = 3;
      b.x = ex.x;
      b.baseX = b.x;
      b.y = 300;
      run(ex, [b], (t) => (t as Balloon).tap(), () => b.state === 'popping' || b.state === 'dead', 1200);
      expect(['popping', 'dead']).toContain(b.state);
    });

    it('ignores balloons that have risen out of arm reach', () => {
      const ex = make();
      ex.spawn();
      const high = new FakeTarget(ex.x, 120, 99); // far above the arm's reach
      for (let i = 0; i < 200; i++) ex.update(1 / 60, [high], noop);
      expect(high.loaded).toBe(false);
      expect(ex.gripping).toBe(false);
    });

    it('skips finger-held, claimed and special balloons', () => {
      const ex = make();
      ex.spawn();
      const dragged = new FakeTarget(ex.x - 20, 300, 99); dragged.dragged = true;
      const claimed = new FakeTarget(ex.x, 300, 99); claimed.loaded = true;
      const special = new FakeTarget(ex.x + 20, 300, 99); special.isDraggable = false;
      for (let i = 0; i < 200; i++) ex.update(1 / 60, [dragged, special], noop);
      expect(dragged.loaded).toBe(false);
      expect(special.loaded).toBe(false);
      expect(claimed.loaded).toBe(true); // its own pre-set flag, never touched by the excavator
      expect(ex.gripping).toBe(false);
    });

    it('grabs the nearest reachable balloon first', () => {
      const ex = make();
      ex.spawn();
      const near = new FakeTarget(ex.x, 350, 99);
      const far = new FakeTarget(ex.x + 220, 300, 99);
      run(ex, [near, far], (t) => (t as FakeTarget).chomp(), () => near.loaded, 600);
      expect(near.loaded).toBe(true);
      expect(far.loaded).toBe(false);
    });

    it('does not fixate on a balloon inside the unreachable inner dead zone', () => {
      // On a wide viewport the two-link arm has a real inner dead zone (it cannot
      // fold past |boom − stick|). A balloon parked at shoulder height must be
      // skipped, not chased forever at the expense of a reachable one.
      const ex = make(2000, 600);
      ex.spawn();
      expect(Math.abs(ex.boomLen - ex.stickLen)).toBeGreaterThan(40); // dead zone exists
      const dead = new FakeTarget(ex.x, ex.shoulderY + 0.35 * 70, 99); // grab point on the shoulder
      const reachable = new FakeTarget(ex.x + 100, 250, 99);
      run(ex, [dead, reachable], (t) => (t as FakeTarget).chomp(), () => reachable.loaded, 900);
      expect(reachable.loaded).toBe(true);
      expect(dead.loaded).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('releases a held balloon when its lifetime ends', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 99);
      run(ex, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.update(EXCAVATOR_LIFETIME + 0.1, [b], noop);
      expect(ex.state).toBe('cooldown');
      expect(b.loaded).toBe(false);
    });

    it('clear() drops the held balloon and skips the cooldown', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 99);
      run(ex, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.clear();
      expect(b.loaded).toBe(false);
      expect(ex.state).toBe('idle');
      expect(ex.isAvailable).toBe(true);
    });

    it('reset() drops the held balloon and returns to a fresh idle state', () => {
      const ex = make();
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 99);
      run(ex, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.reset();
      expect(b.loaded).toBe(false);
      expect(ex.state).toBe('idle');
      expect(ex.alpha).toBe(0);
    });

    it('keeps holding a balloon (and on-screen) across a shrinking resize', () => {
      const ex = make(800, 600);
      ex.spawn();
      const b = new FakeTarget(ex.x, 300, 99);
      run(ex, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.setScreenSize(400, 300);
      for (let i = 0; i < 60; i++) ex.update(1 / 60, [b], (t) => (t as FakeTarget).chomp());
      expect(b.loaded).toBe(true);
      expect(ex.x + ex.size * 0.46).toBeLessThanOrEqual(400 + 1);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(400);
    });
  });
});

// Build the five vehicle spawn buttons at a given viewport for placement checks.
function makeAllButtons(w: number, h: number): Array<{ x: number; y: number; r: number }> {
  const heli = new HelicopterManager();
  heli.setScreenSize(w, h);
  const plane = new PlaneManager();
  plane.setScreenSize(w, h);
  const dozer = new BulldozerManager();
  dozer.setScreenSize(w, h);
  const tractor = new TractorManager();
  tractor.setScreenSize(w, h);
  const excavator = new ExcavatorManager();
  excavator.setScreenSize(w, h);
  const firetruck = new FiretruckManager();
  firetruck.setScreenSize(w, h);
  return [
    { x: heli.buttonX, y: heli.buttonY, r: heli.buttonRadius },
    { x: plane.buttonX, y: plane.buttonY, r: plane.buttonRadius },
    { x: dozer.buttonX, y: dozer.buttonY, r: dozer.buttonRadius },
    { x: tractor.buttonX, y: tractor.buttonY, r: tractor.buttonRadius },
    { x: excavator.buttonX, y: excavator.buttonY, r: excavator.buttonRadius },
    { x: firetruck.buttonX, y: firetruck.buttonY, r: firetruck.buttonRadius },
  ];
}
