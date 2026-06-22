import { describe, it, expect } from 'vitest';
import { HelicopterManager } from '../helicopter';
import { Balloon } from '../balloon';
import {
  HELICOPTER_LIFETIME,
  HELICOPTER_COOLDOWN,
  DART_FIRE_INTERVAL,
} from '../constants';

// Lightweight stand-in for a balloon target.
class FakeTarget {
  constructor(public x: number, public y: number, public alive = true, public radius = 40) {}
  hitTest(px: number, py: number): boolean {
    return this.alive && Math.hypot(px - this.x, py - this.y) <= this.radius;
  }
}

function makeHeli(): HelicopterManager {
  const h = new HelicopterManager();
  h.setScreenSize(800, 600);
  return h;
}

const noop = () => {};

describe('HelicopterManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const h = makeHeli();
      expect(h.state).toBe('idle');
      expect(h.isAvailable).toBe(true);
      expect(h.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const h = makeHeli();
      const spawned = h.trySpawn(h.buttonX, h.buttonY);
      expect(spawned).toBe(true);
      expect(h.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const h = makeHeli();
      const spawned = h.trySpawn(600, 400);
      expect(spawned).toBe(false);
      expect(h.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const h = makeHeli();
      h.spawn();
      expect(h.trySpawn(h.buttonX, h.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const h = makeHeli();
      h.spawn();
      h.update(HELICOPTER_LIFETIME + 0.1, [], noop);
      expect(h.state).toBe('cooldown');
      expect(h.darts.length).toBe(0);
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const h = makeHeli();
      h.spawn();
      h.update(HELICOPTER_LIFETIME + 0.1, [], noop);
      expect(h.isAvailable).toBe(false);
      expect(h.trySpawn(h.buttonX, h.buttonY)).toBe(false);
      h.update(HELICOPTER_COOLDOWN + 0.1, [], noop);
      expect(h.state).toBe('idle');
      expect(h.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const h = makeHeli();
      h.spawn();
      h.update(HELICOPTER_LIFETIME + 0.01, [], noop); // -> cooldown
      const start = h.cooldownProgress;
      h.update(HELICOPTER_COOLDOWN / 2, [], noop);
      const mid = h.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });
  });

  describe('firing', () => {
    it('fires a dart at an in-range target and reports it', () => {
      const h = makeHeli();
      h.spawn();
      const target = new FakeTarget(h.x + 120, h.displayY); // within dartRange
      let fires = 0;
      h.update(0.02, [target], noop, () => { fires++; });
      expect(h.darts.length).toBe(1);
      expect(fires).toBe(1);
    });

    it('does not fire when there are no targets', () => {
      const h = makeHeli();
      h.spawn();
      let fires = 0;
      h.update(DART_FIRE_INTERVAL * 2, [], noop, () => { fires++; });
      expect(h.darts.length).toBe(0);
      expect(fires).toBe(0);
    });

    it('does not fire at a target beyond range', () => {
      const h = makeHeli();
      h.spawn();
      const farTarget = new FakeTarget(h.x + h.dartRange + 50, h.displayY);
      let fires = 0;
      h.update(DART_FIRE_INTERVAL * 2, [farTarget], noop, () => { fires++; });
      expect(h.darts.length).toBe(0);
      expect(fires).toBe(0);
    });

    it('aims darts toward the nearest poppable target', () => {
      const h = makeHeli();
      h.spawn();
      const near = new FakeTarget(h.x + 120, h.displayY);
      const far = new FakeTarget(h.x + 600, h.displayY);
      const nearest = (h as any).nearestTarget([far, near]);
      expect(nearest).toBe(near);
    });

    it('skips dead/unpoppable targets when aiming', () => {
      const h = makeHeli();
      h.spawn();
      const deadNear = new FakeTarget(h.x + 100, h.displayY, false);
      const liveFar = new FakeTarget(h.x + 500, h.displayY, true);
      const nearest = (h as any).nearestTarget([deadNear, liveFar]);
      expect(nearest).toBe(liveFar);
    });
  });

  describe('dart hits', () => {
    it('hits a balloon in its path, taps it, and consumes the dart', () => {
      const h = makeHeli();
      h.spawn();
      (h as any).fireTimer = 0; // disable auto-fire for a deterministic check

      const b = new Balloon(800, 600);
      b.x = 400;
      b.y = 300;
      b.baseX = 400;
      b.number = 3;

      // A dart one step away from the balloon centre, travelling right.
      h.darts = [{ x: 380, y: 300, vx: 660, vy: 0, age: 0, traveled: 0 }];

      let hit: Balloon | null = null;
      h.update(0.05, [b], (t) => { hit = t; t.tap(); });

      expect(hit).toBe(b);
      expect(b.number).toBe(2); // a dart decrements rather than instantly popping
      expect(h.darts.length).toBe(0);
    });

    it('culls darts that fly off-screen without hitting anything', () => {
      const h = makeHeli();
      h.spawn();
      (h as any).fireTimer = 0;
      h.darts = [{ x: 790, y: 300, vx: 660, vy: 0, age: 0, traveled: 0 }];
      h.update(0.1, [], noop);
      expect(h.darts.length).toBe(0);
    });

    it('fizzles darts out once they reach maximum range', () => {
      const h = makeHeli();
      h.spawn();
      (h as any).fireTimer = 0; // no auto-fire interference
      // A dart well within the screen but travelling past its range this step.
      h.darts = [{ x: 100, y: 300, vx: 450, vy: 0, age: 0, traveled: h.dartRange - 10 }];
      h.update(0.1, [], noop); // moves 45px -> traveled exceeds range
      expect(h.darts.length).toBe(0);
    });
  });

  describe('dragging', () => {
    it('can be grabbed, moved, and released by pointer id', () => {
      const h = makeHeli();
      h.spawn();
      const grabbed = h.tryGrab(1, h.x, h.displayY);
      expect(grabbed).toBe(true);
      const moved = h.drag(1, 300, 250);
      expect(moved).toBe(true);
      expect(h.x).toBe(300);
      expect(h.y).toBe(250);
      expect(h.release(1)).toBe(true);
      expect(h.drag(1, 100, 100)).toBe(false);
    });

    it('ignores grab attempts far from the helicopter', () => {
      const h = makeHeli();
      h.spawn();
      expect(h.tryGrab(1, h.x + 1000, h.displayY)).toBe(false);
    });

    it('keeps the body on screen while dragging', () => {
      const h = makeHeli();
      h.spawn();
      h.tryGrab(1, h.x, h.displayY);
      h.drag(1, -500, -500);
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeGreaterThanOrEqual(0);
    });

    it('preserves the grab offset instead of snapping to the pointer', () => {
      const h = makeHeli();
      h.spawn();
      const startX = h.x;
      // Grab 40px right of the centre, then move the pointer +100.
      h.tryGrab(2, startX + 40, h.displayY);
      h.drag(2, startX + 140, h.displayY);
      // Body moves by the same +100 (offset kept) — not snapped under the pointer.
      expect(h.x).toBe(startX + 100);
    });

    it('cannot be grabbed when not active', () => {
      const h = makeHeli();
      expect(h.tryGrab(1, h.x, h.displayY)).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('clear() removes the helicopter without a cooldown', () => {
      const h = makeHeli();
      h.spawn();
      h.darts = [{ x: 1, y: 1, vx: 1, vy: 1, age: 0, traveled: 0 }];
      h.clear();
      expect(h.state).toBe('idle');
      expect(h.isAvailable).toBe(true);
      expect(h.darts.length).toBe(0);
    });

    it('reset() returns to a fresh idle state', () => {
      const h = makeHeli();
      h.spawn();
      h.update(HELICOPTER_LIFETIME + 0.1, [], noop); // cooldown
      h.reset();
      expect(h.state).toBe('idle');
      expect(h.isAvailable).toBe(true);
    });

    it('re-clamps an active helicopter onto a shrunken screen', () => {
      const h = makeHeli(); // 800 x 600
      h.spawn();
      h.tryGrab(1, h.x, h.displayY);
      h.drag(1, 760, 560); // toward the bottom-right
      h.setScreenSize(400, 300);
      const half = h.size * 0.5;
      expect(h.x).toBeLessThanOrEqual(400 - half);
      expect(h.y).toBeLessThanOrEqual(300 - half);
      expect(h.x).toBeGreaterThanOrEqual(half);
      expect(h.y).toBeGreaterThanOrEqual(half);
    });
  });
});
