import { describe, it, expect } from 'vitest';
import { PlaneManager, Missile } from '../plane';
import { HelicopterManager } from '../helicopter';
import { Balloon } from '../balloon';
import {
  PLANE_LIFETIME,
  PLANE_COOLDOWN,
  MISSILE_SPEED,
  MISSILE_LIFETIME,
  MISSILE_MUZZLE_OFFSET_RATIO,
  PLANE_RUN_TURN_BIAS,
} from '../constants';

// Lightweight stand-in for a balloon target.
class FakeTarget {
  constructor(public x: number, public y: number, public alive = true, public radius = 40) {}
  hitTest(px: number, py: number): boolean {
    return this.alive && Math.hypot(px - this.x, py - this.y) <= this.radius;
  }
}

function makePlane(): PlaneManager {
  const p = new PlaneManager();
  p.setScreenSize(800, 600);
  return p;
}

const noop = () => {};
// A central focus point used by most tests.
const FX = 400;
const FY = 300;

describe('PlaneManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const p = makePlane();
      expect(p.state).toBe('idle');
      expect(p.isAvailable).toBe(true);
      expect(p.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const p = makePlane();
      const spawned = p.trySpawn(p.buttonX, p.buttonY);
      expect(spawned).toBe(true);
      expect(p.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const p = makePlane();
      const spawned = p.trySpawn(600, 400);
      expect(spawned).toBe(false);
      expect(p.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const p = makePlane();
      p.spawn();
      expect(p.trySpawn(p.buttonX, p.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const p = makePlane();
      p.spawn();
      p.update(PLANE_LIFETIME + 0.1, FX, FY, [], noop);
      expect(p.state).toBe('cooldown');
      expect(p.missiles.length).toBe(0);
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const p = makePlane();
      p.spawn();
      p.update(PLANE_LIFETIME + 0.1, FX, FY, [], noop);
      expect(p.isAvailable).toBe(false);
      expect(p.trySpawn(p.buttonX, p.buttonY)).toBe(false);
      p.update(PLANE_COOLDOWN + 0.1, FX, FY, [], noop);
      expect(p.state).toBe('idle');
      expect(p.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const p = makePlane();
      p.spawn();
      p.update(PLANE_LIFETIME + 0.01, FX, FY, [], noop); // -> cooldown
      const start = p.cooldownProgress;
      p.update(PLANE_COOLDOWN / 2, FX, FY, [], noop);
      const mid = p.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });
  });

  describe('spawn button placement', () => {
    it('stacks directly below the helicopter button, sharing the left edge', () => {
      const p = makePlane();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      expect(p.buttonX).toBe(heli.buttonX);
      expect(p.buttonY).toBeGreaterThan(heli.buttonY);
    });

    it('keeps the two button touch targets from overlapping on any screen', () => {
      // Includes a small phone and a large screen where the radius is capped.
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480]]) {
        const p = new PlaneManager();
        p.setScreenSize(w, h);
        const heli = new HelicopterManager();
        heli.setScreenSize(w, h);
        const dist = Math.hypot(p.buttonX - heli.buttonX, p.buttonY - heli.buttonY);
        // Both buttons use a 1.25× touch radius (see buttonHitTest).
        expect(dist).toBeGreaterThanOrEqual((p.buttonRadius + heli.buttonRadius) * 1.25);
      }
    });
  });

  describe('firing missiles', () => {
    it('launches a missile at an in-range target and reports it', () => {
      const p = makePlane();
      p.spawn();
      const target = new FakeTarget(p.x + 100, p.y); // within missileRange
      let fires = 0;
      p.update(0.02, FX, FY, [target], noop, () => { fires++; });
      expect(p.missiles.length).toBe(1);
      expect(fires).toBe(1);
    });

    it('does not fire when there are no targets', () => {
      const p = makePlane();
      p.spawn(); // spawn primes fireTimer, so a single small step attempts a shot
      let fires = 0;
      p.update(0.02, FX, FY, [], noop, () => { fires++; });
      expect(p.missiles.length).toBe(0);
      expect(fires).toBe(0);
    });

    it('does not fire at a target beyond range', () => {
      const p = makePlane();
      p.spawn();
      const far = new FakeTarget(p.x + p.missileRange + 200, p.y);
      let fires = 0;
      p.update(0.02, FX, FY, [far], noop, () => { fires++; });
      expect(p.missiles.length).toBe(0);
      expect(fires).toBe(0);
    });

    it('locks onto the nearest poppable target', () => {
      const p = makePlane();
      p.spawn();
      const near = new FakeTarget(p.x + 120, p.y);
      const far = new FakeTarget(p.x + 300, p.y);
      const nearest = (p as any).nearestTarget([far, near], p.x, p.y);
      expect(nearest).toBe(near);
    });

    it('skips dead/unpoppable targets when locking on', () => {
      const p = makePlane();
      p.spawn();
      const deadNear = new FakeTarget(p.x + 100, p.y, false);
      const liveFar = new FakeTarget(p.x + 260, p.y, true);
      const nearest = (p as any).nearestTarget([deadNear, liveFar], p.x, p.y);
      expect(nearest).toBe(liveFar);
    });

    it('launches missiles from a muzzle offset in front of the plane', () => {
      const p = makePlane();
      p.spawn();
      const target = new FakeTarget(p.x + 120, p.y);
      (p as any).fireMissileAt(target);
      const m = p.missiles[0];
      const muzzle = p.size * MISSILE_MUZZLE_OFFSET_RATIO;
      expect(m.x).toBeCloseTo(p.x + Math.cos(p.heading) * muzzle, 3);
      expect(m.y).toBeCloseTo(p.y + Math.sin(p.heading) * muzzle, 3);
    });
  });

  describe('homing', () => {
    it('curves a missile toward its target while keeping a constant speed', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = 0; // no auto-fire interference

      const target = new FakeTarget(400, 100); // directly above the missile
      const missile: Missile = { x: 400, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target };
      p.missiles = [missile];

      p.update(0.05, FX, FY, [target], noop);

      // Velocity has banked upward (toward the target) but kept its magnitude.
      expect(missile.vy).toBeLessThan(0);
      expect(missile.vx).toBeGreaterThan(0);
      expect(Math.hypot(missile.vx, missile.vy)).toBeCloseTo(MISSILE_SPEED, 1);
    });

    it('re-acquires the nearest live target when its own target dies', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = 0;

      const dead = new FakeTarget(400, 280, false);
      const liveFar = new FakeTarget(600, 300, true);
      const liveNear = new FakeTarget(440, 300, true);
      const missile: Missile = { x: 400, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target: dead };
      p.missiles = [missile];

      p.update(0.02, FX, FY, [dead, liveFar, liveNear], noop);
      expect(missile.target).toBe(liveNear); // nearest of the live ones
    });

    it('chases and intercepts a moving target', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = -1000; // never auto-fire during this test

      const target = new FakeTarget(400, 120, true, 22);
      // Missile starts below, heading straight up toward the target.
      p.missiles = [{ x: 400, y: 360, vx: 0, vy: -MISSILE_SPEED, age: 0, target }];

      let hit = false;
      for (let i = 0; i < 60 && !hit; i++) {
        target.x += 6; // target drifts sideways each frame
        p.update(0.05, FX, FY, [target], () => { hit = true; });
      }
      expect(hit).toBe(true);
    });

    it('tracks several missiles toward their own targets independently', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = -1000;

      const up = new FakeTarget(400, 100, true);
      const down = new FakeTarget(400, 500, true);
      const mUp: Missile = { x: 400, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target: up };
      const mDown: Missile = { x: 400, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target: down };
      p.missiles = [mUp, mDown];

      p.update(0.05, FX, FY, [up, down], noop);

      expect(mUp.vy).toBeLessThan(0);   // banked upward toward its target
      expect(mDown.vy).toBeGreaterThan(0); // banked downward toward its target
    });
  });

  describe('missile hits', () => {
    it('hits a balloon in its path, fires onHit, and consumes the missile', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = 0; // deterministic: no extra missiles

      const b = new Balloon(800, 600);
      b.x = 400;
      b.y = 300;
      b.baseX = 400;
      b.number = 4;

      // A missile just short of the balloon centre, travelling right toward it.
      p.missiles = [{ x: 380, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target: b }];

      let hit: Balloon | null = null;
      // The game destroys MISSILE_DAMAGE (2) layers per hit; emulate that here.
      p.update(0.2, FX, FY, [b], (t) => { hit = t; t.tap(); t.tap(); });

      expect(hit).toBe(b);
      expect(b.number).toBe(2); // 4 -> 2 after a two-layer missile hit
      expect(p.missiles.length).toBe(0);
    });

    it('culls missiles that fly off-screen', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = 0;
      p.missiles = [{ x: 790, y: 300, vx: MISSILE_SPEED, vy: 0, age: 0, target: null }];
      p.update(0.5, FX, FY, [], noop);
      expect(p.missiles.length).toBe(0);
    });

    it('culls missiles that time out', () => {
      const p = makePlane();
      p.spawn();
      (p as any).fireTimer = 0;
      p.missiles = [{ x: 400, y: 300, vx: 1, vy: 0, age: MISSILE_LIFETIME - 0.05, target: null }];
      p.update(0.2, FX, FY, [], noop);
      expect(p.missiles.length).toBe(0);
    });
  });

  describe('strafing movement', () => {
    it('flies toward the focus point', () => {
      const p = makePlane();
      p.spawn();
      const startX = p.x; // launches from the button on the left edge
      for (let i = 0; i < 5; i++) {
        p.update(0.1, 700, 300, [], noop); // focus to the right
      }
      expect(p.x).toBeGreaterThan(startX);
    });

    it('reverses and rotates its run after reaching the run waypoint', () => {
      const p = makePlane();
      p.spawn();
      // Aim the run straight right and drop the plane onto its (clamped) waypoint.
      (p as any).runAngle = 0;
      p.heading = 0;
      const margin = p.size * 0.5;
      p.x = Math.min(800 - margin, FX + p.overshoot);
      p.y = FY;

      p.update(0.01, FX, FY, [], noop);

      // The next run reverses direction (≈π) and rotates by the sweep bias.
      const runAngle = (p as any).runAngle as number;
      expect(runAngle).toBeCloseTo(Math.PI + PLANE_RUN_TURN_BIAS, 5);
    });

    it('oscillates back and forth and never leaves the screen', () => {
      const p = makePlane();
      p.spawn();
      let reversals = 0;
      let prev = (p as any).runAngle as number;
      let minFocusDist = Infinity;
      let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity;
      for (let i = 0; i < 400; i++) {
        p.update(1 / 60, FX, FY, [], noop);
        const cur = (p as any).runAngle as number;
        if (cur !== prev) { reversals++; prev = cur; }
        minFocusDist = Math.min(minFocusDist, Math.hypot(p.x - FX, p.y - FY));
        maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x);
        maxY = Math.max(maxY, p.y); minY = Math.min(minY, p.y);
      }
      // It keeps strafing (multiple turnarounds) and swings close past the focus.
      expect(reversals).toBeGreaterThanOrEqual(2);
      expect(minFocusDist).toBeLessThan(p.overshoot);
      // It stays fully on screen the whole time.
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(800);
      expect(maxY).toBeLessThanOrEqual(600);
    });

    it('adjusts course when the focus point moves mid-flight', () => {
      const p = makePlane();
      p.spawn();
      for (let i = 0; i < 6; i++) p.update(0.05, 700, 300, [], noop); // settle heading right
      const before = p.heading;
      for (let i = 0; i < 3; i++) p.update(0.05, 100, 540, [], noop); // focus jumps elsewhere
      expect(p.heading).not.toBeCloseTo(before, 2);
      expect(Number.isFinite(p.heading)).toBe(true);
    });

    it('keeps a finite heading when the focus sits on the plane', () => {
      const p = makePlane();
      p.spawn();
      p.x = FX;
      p.y = FY;
      p.update(0.1, FX, FY, [], noop);
      expect(Number.isFinite(p.heading)).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('fades in on spawn and out at the end of its life', () => {
      const p = makePlane();
      p.spawn();
      expect(p.alpha).toBe(0); // invisible at the instant of spawn
      p.update(0.15, FX, FY, [], noop);
      expect(p.alpha).toBeGreaterThan(0.3);
      expect(p.alpha).toBeLessThan(0.7);
      // Near the very end of life it is fading back out.
      p.update(PLANE_LIFETIME - 0.5, FX, FY, [], noop);
      const fading = p.alpha;
      expect(fading).toBeGreaterThan(0);
      expect(fading).toBeLessThan(1);
    });

    it('clear() removes the plane without a cooldown', () => {
      const p = makePlane();
      p.spawn();
      p.missiles = [{ x: 1, y: 1, vx: 1, vy: 1, age: 0, target: null }];
      p.clear();
      expect(p.state).toBe('idle');
      expect(p.isAvailable).toBe(true);
      expect(p.missiles.length).toBe(0);
    });

    it('reset() returns to a fresh idle state', () => {
      const p = makePlane();
      p.spawn();
      p.update(PLANE_LIFETIME + 0.1, FX, FY, [], noop); // cooldown
      p.reset();
      expect(p.state).toBe('idle');
      expect(p.isAvailable).toBe(true);
    });
  });
});
