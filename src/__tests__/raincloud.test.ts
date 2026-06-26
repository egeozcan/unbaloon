import { describe, it, expect, vi } from 'vitest';
import { RainCloudManager, RainTarget } from '../raincloud';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { BulldozerManager } from '../bulldozer';
import { TractorManager } from '../tractor';
import { Balloon } from '../balloon';
import {
  RAIN_LIFETIME,
  RAIN_COOLDOWN,
  RAIN_SLOW_FACTOR,
  RAIN_BODY_HALF_RATIO,
  RAIN_RETARGET_MIN,
  RAIN_RETARGET_MAX,
} from '../constants';

// Lightweight stand-in for a balloon the cloud can rain on. Counts the slow calls
// (the manager's only responsibility toward a balloon) and mirrors the real
// Balloon.applyRainSlow clamp so the recorded factor reads true.
class FakeTarget implements RainTarget {
  loaded = false;
  rainSlow = 1;
  rainCalls = 0;
  constructor(public x: number, public y: number) {}
  applyRainSlow(): void {
    this.rainCalls++;
    this.rainSlow = Math.min(this.rainSlow, RAIN_SLOW_FACTOR);
  }
}

function makeRain(w = 800, h = 600): RainCloudManager {
  const r = new RainCloudManager();
  r.setScreenSize(w, h);
  return r;
}

describe('RainCloudManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const r = makeRain();
      expect(r.state).toBe('idle');
      expect(r.isAvailable).toBe(true);
      expect(r.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const r = makeRain();
      expect(r.trySpawn(r.buttonX, r.buttonY)).toBe(true);
      expect(r.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const r = makeRain();
      expect(r.trySpawn(400, 300)).toBe(false);
      expect(r.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const r = makeRain();
      r.spawn();
      expect(r.trySpawn(r.buttonX, r.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const r = makeRain();
      r.spawn();
      r.update(RAIN_LIFETIME + 0.1, []);
      expect(r.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const r = makeRain();
      r.spawn();
      r.update(RAIN_LIFETIME + 0.1, []);
      expect(r.isAvailable).toBe(false);
      expect(r.trySpawn(r.buttonX, r.buttonY)).toBe(false);
      r.update(RAIN_COOLDOWN + 0.1, []);
      expect(r.state).toBe('idle');
      expect(r.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const r = makeRain();
      r.spawn();
      r.update(RAIN_LIFETIME + 0.01, []); // -> cooldown
      const start = r.cooldownProgress;
      r.update(RAIN_COOLDOWN / 2, []);
      const mid = r.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });

    it('fades in on spawn and out at end of life', () => {
      const r = makeRain();
      r.spawn();
      expect(r.alpha).toBe(0);                  // nothing elapsed yet
      r.update(0.3, []);
      expect(r.alpha).toBeCloseTo(1, 1);        // faded in
      r.update(RAIN_LIFETIME - 0.3 - 0.6, []);  // near the end
      expect(r.alpha).toBeLessThan(1);          // fading out
      expect(r.alpha).toBeGreaterThan(0);
    });
  });

  describe('spawn button placement (right edge, opposite the vehicles)', () => {
    it('sits on the opposite side from the vehicle column', () => {
      const r = makeRain();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      // Mirror image of the left-edge vehicle column across the screen centre.
      expect(r.buttonX).toBeCloseTo(800 - heli.buttonX, 6);
      expect(r.buttonX).toBeGreaterThan(400); // right half
    });

    it('lines up vertically with the top vehicle button and shares its radius', () => {
      const r = makeRain();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      expect(r.buttonY).toBe(heli.buttonY); // both index 0 of their columns
      expect(r.buttonRadius).toBe(heli.buttonRadius);
    });

    it('keeps its touch target fully on-screen across viewports', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [667, 375], [480, 300]]) {
        const r = makeRain(w, h);
        const reach = r.buttonRadius * 1.25;
        expect(r.buttonY - reach).toBeGreaterThanOrEqual(0);
        expect(r.buttonY + reach).toBeLessThanOrEqual(h);
        expect(r.buttonX + reach).toBeLessThanOrEqual(w);
        expect(r.buttonX - reach).toBeGreaterThanOrEqual(0);
      }
    });

    it('never overlaps a vehicle button touch target on any screen', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [667, 375], [480, 300]]) {
        const r = makeRain(w, h);
        const rain = { x: r.buttonX, y: r.buttonY, ra: r.buttonRadius };
        for (const v of makeVehicleButtons(w, h)) {
          const dist = Math.hypot(rain.x - v.x, rain.y - v.y);
          expect(dist).toBeGreaterThanOrEqual((rain.ra + v.r) * 1.25);
        }
      }
    });
  });

  describe('wandering movement', () => {
    it('stays near the top of the screen', () => {
      const r = makeRain();
      r.spawn();
      for (let i = 0; i < 600; i++) {
        r.update(1 / 60, []);
        expect(r.y).toBeGreaterThan(0);
        expect(r.y).toBeLessThan(600 * 0.25); // well within the top quarter
      }
    });

    it('drifts horizontally while keeping the whole cloud body on-screen', () => {
      const r = makeRain();
      r.spawn();
      let sawLeftward = false;
      let sawRightward = false;
      let prev = r.x;
      for (let i = 0; i < 1500; i++) {
        r.update(1 / 60, []);
        // The drawn body (lobes overhang to ~0.57·size) never clips a side wall —
        // the wander band reserves a full RAIN_BODY_HALF_RATIO each side.
        const bodyHalf = r.size * RAIN_BODY_HALF_RATIO;
        expect(r.x - bodyHalf).toBeGreaterThanOrEqual(-1);
        expect(r.x + bodyHalf).toBeLessThanOrEqual(800 + 1);
        if (r.x < prev - 0.01) sawLeftward = true;
        if (r.x > prev + 0.01) sawRightward = true;
        prev = r.x;
      }
      // Goes both directions (rules out a one-way drift). Non-linearity — that it
      // turns at interior points, not only at the walls — is covered below.
      expect(sawLeftward).toBe(true);
      expect(sawRightward).toBe(true);
    });

    it('reverses direction at interior points — a random wander, not a linear sweep', () => {
      // A tractor-style linear ping-pong only turns at the two band walls; a random
      // wander re-targets mid-flight and so reverses well inside the band. Assert at
      // least one direction change happens comfortably away from either wall.
      const r = makeRain();
      r.spawn();
      let prev = r.x;
      let prevDir = 0;
      let interiorReversal = false;
      for (let i = 0; i < 2000; i++) {
        r.update(1 / 60, []);
        const dir = Math.sign(r.x - prev);
        if (dir !== 0 && prevDir !== 0 && dir !== prevDir) {
          if (r.x > 800 * 0.3 && r.x < 800 * 0.7) interiorReversal = true;
        }
        if (dir !== 0) prevDir = dir;
        prev = r.x;
      }
      expect(interiorReversal).toBe(true);
    });

    it('derives its dwell interval from randomness, not a fixed cadence', () => {
      // Mock the RNG so pickTarget is deterministic, then confirm the dwell interval
      // is the random-derived value (a fixed linear sweep would have no such dwell).
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      try {
        const r = makeRain();
        r.spawn(); // calls pickTarget()
        const expected = RAIN_RETARGET_MIN + 0.5 * (RAIN_RETARGET_MAX - RAIN_RETARGET_MIN);
        expect((r as unknown as { retargetInterval: number }).retargetInterval).toBeCloseTo(expected, 5);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('raining on balloons', () => {
    it('slows a balloon sitting in the column below the cloud', () => {
      const r = makeRain();
      r.spawn();
      const b = new FakeTarget(r.x, 300); // directly under the cloud, well below it
      for (let i = 0; i < 5; i++) r.update(1 / 60, [b]);
      // The manager's job is to *call* applyRainSlow on in-column balloons; the slow
      // magnitude itself is verified against a real Balloon below.
      expect(b.rainCalls).toBeGreaterThan(0);
      expect(b.rainSlow).toBeLessThan(1);
    });

    it('ignores balloons outside the rain column', () => {
      const r = makeRain();
      r.spawn();
      const outside = new FakeTarget(r.x + r.rainHalfWidth + 60, 300);
      r.update(1 / 60, [outside]);
      expect(outside.rainSlow).toBe(1);
    });

    it('ignores balloons above the cloud (rain only falls downward)', () => {
      const r = makeRain();
      r.spawn();
      const above = new FakeTarget(r.x, 20); // higher than the cloud
      r.update(1 / 60, [above]);
      expect(above.rainSlow).toBe(1);
    });

    it('ignores balloons the tractor has loaded', () => {
      const r = makeRain();
      r.spawn();
      const loaded = new FakeTarget(r.x, 300);
      loaded.loaded = true;
      r.update(1 / 60, [loaded]);
      expect(loaded.rainSlow).toBe(1);
    });

    it('does not rain while idle or in cooldown', () => {
      const r = makeRain();
      // Idle: a balloon right where the cloud would sit is untouched.
      const idleTarget = new FakeTarget(400, 300);
      r.update(1 / 60, [idleTarget]);
      expect(idleTarget.rainCalls).toBe(0);
      expect(idleTarget.rainSlow).toBe(1);
      // Drive to cooldown (no targets on the transition frame), then confirm a
      // balloon under the now-gone cloud is untouched.
      r.spawn();
      r.update(RAIN_LIFETIME + 0.1, []);
      expect(r.state).toBe('cooldown');
      const cdTarget = new FakeTarget(r.x, 300);
      r.update(1 / 60, [cdTarget]);
      expect(cdTarget.rainCalls).toBe(0);
      expect(cdTarget.rainSlow).toBe(1);
    });

    it('throttles a real balloon to ~RAIN_SLOW_FACTOR of full rise speed under continuous rain', () => {
      // Two identical balloons, same forced rise speed; one is kept under the rain.
      // The cloud applies the slow AFTER the balloon moves (game update order), so
      // the steady-state multiplier is exactly RAIN_SLOW_FACTOR, frame-rate aside.
      const startY = 560;
      const rained = new Balloon(800, 600);
      const clear = new Balloon(800, 600);
      (rained as unknown as { speed: number }).speed = 80;
      (clear as unknown as { speed: number }).speed = 80;
      rained.y = clear.y = startY;
      const frames = 300;
      for (let i = 0; i < frames; i++) {
        rained.update(1 / 60);   // balloon moves & recovers first…
        rained.applyRainSlow();  // …then the cloud re-applies the slow
        clear.update(1 / 60);
      }
      const rainedRise = startY - rained.y;
      const clearRise = startY - clear.y;
      expect(rainedRise).toBeGreaterThan(0);
      // Throttled to the slow floor (a touch above it from the first, pre-slow frame).
      const ratio = rainedRise / clearRise;
      expect(ratio).toBeGreaterThan(RAIN_SLOW_FACTOR - 0.05);
      expect(ratio).toBeLessThan(RAIN_SLOW_FACTOR + 0.05);
    });

    it('recovers a balloon to full speed once the rain stops', () => {
      const b = new Balloon(800, 600);
      b.applyRainSlow();
      expect(b.rainSlow).toBeCloseTo(RAIN_SLOW_FACTOR, 5);
      for (let i = 0; i < 60; i++) b.update(1 / 60); // no more rain
      expect(b.rainSlow).toBe(1);
    });
  });

  describe('lifecycle', () => {
    it('clear() returns to idle without a cooldown', () => {
      const r = makeRain();
      r.spawn();
      r.update(1, []);
      r.clear();
      expect(r.state).toBe('idle');
      expect(r.isAvailable).toBe(true);
    });

    it('reset() returns to a fresh idle state', () => {
      const r = makeRain();
      r.spawn();
      r.update(2, []);
      r.reset();
      expect(r.state).toBe('idle');
      expect(r.isAvailable).toBe(true);
      expect(r.alpha).toBe(0);
    });

    it('re-clamps an active cloud onto a shrunken screen', () => {
      const r = makeRain(800, 600);
      r.spawn();
      r.update(1 / 60, []);
      r.setScreenSize(400, 300);
      const bodyHalf = r.size * RAIN_BODY_HALF_RATIO;
      expect(r.x - bodyHalf).toBeGreaterThanOrEqual(-1);
      expect(r.x + bodyHalf).toBeLessThanOrEqual(400 + 1);
    });
  });
});

// The four left-edge vehicle spawn buttons, for placement checks.
function makeVehicleButtons(w: number, h: number): Array<{ x: number; y: number; r: number }> {
  const heli = new HelicopterManager();
  heli.setScreenSize(w, h);
  const plane = new PlaneManager();
  plane.setScreenSize(w, h);
  const dozer = new BulldozerManager();
  dozer.setScreenSize(w, h);
  const tractor = new TractorManager();
  tractor.setScreenSize(w, h);
  return [
    { x: heli.buttonX, y: heli.buttonY, r: heli.buttonRadius },
    { x: plane.buttonX, y: plane.buttonY, r: plane.buttonRadius },
    { x: dozer.buttonX, y: dozer.buttonY, r: dozer.buttonRadius },
    { x: tractor.buttonX, y: tractor.buttonY, r: tractor.buttonRadius },
  ];
}
