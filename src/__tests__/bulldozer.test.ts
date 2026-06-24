import { describe, it, expect } from 'vitest';
import { BulldozerManager, PushTarget } from '../bulldozer';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { Balloon } from '../balloon';
import {
  BULLDOZER_LIFETIME,
  BULLDOZER_COOLDOWN,
  BULLDOZER_PIN_SLACK,
  BULLDOZER_CRUSH_INTERVAL,
} from '../constants';

// Lightweight stand-in for a balloon the bulldozer can shove and crush. Mirrors
// the writable fields the manager mutates; `crush()` decrements like Balloon.tap.
class FakeTarget implements PushTarget {
  baseX: number;
  dragged = false;
  constructor(
    public x: number,
    public y: number,
    public alive = true,
    public radiusX = 56,
    public radiusY = 70,
    public layers = 1,
  ) {
    this.baseX = x;
  }
  hitTest(px: number, py: number): boolean {
    if (!this.alive) return false;
    const dx = (px - this.x) / this.radiusX;
    const dy = (py - this.y) / this.radiusY;
    return dx * dx + dy * dy <= 1;
  }
  crush(): void {
    this.layers -= 1;
    if (this.layers <= 0) this.alive = false;
  }
}

function makeDozer(): BulldozerManager {
  const d = new BulldozerManager();
  d.setScreenSize(800, 600);
  return d;
}

const noop = () => {};

// Run the manager until `done` returns true or the frame cap is hit. Returns the
// number of frames actually run (dt is a steady 1/60s).
function run(
  d: BulldozerManager,
  targets: PushTarget[],
  onCrush: (t: PushTarget) => void,
  done: () => boolean,
  maxFrames = 1500,
): number {
  let f = 0;
  for (; f < maxFrames; f++) {
    d.update(1 / 60, targets, onCrush);
    if (done()) break;
  }
  return f;
}

describe('BulldozerManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const d = makeDozer();
      expect(d.state).toBe('idle');
      expect(d.isAvailable).toBe(true);
      expect(d.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const d = makeDozer();
      expect(d.trySpawn(d.buttonX, d.buttonY)).toBe(true);
      expect(d.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const d = makeDozer();
      expect(d.trySpawn(600, 400)).toBe(false);
      expect(d.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const d = makeDozer();
      d.spawn();
      expect(d.trySpawn(d.buttonX, d.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const d = makeDozer();
      d.spawn();
      d.update(BULLDOZER_LIFETIME + 0.1, [], noop);
      expect(d.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const d = makeDozer();
      d.spawn();
      d.update(BULLDOZER_LIFETIME + 0.1, [], noop);
      expect(d.isAvailable).toBe(false);
      expect(d.trySpawn(d.buttonX, d.buttonY)).toBe(false);
      d.update(BULLDOZER_COOLDOWN + 0.1, [], noop);
      expect(d.state).toBe('idle');
      expect(d.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const d = makeDozer();
      d.spawn();
      d.update(BULLDOZER_LIFETIME + 0.01, [], noop); // -> cooldown
      const start = d.cooldownProgress;
      d.update(BULLDOZER_COOLDOWN / 2, [], noop);
      const mid = d.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });
  });

  describe('spawn button placement', () => {
    it('stacks below the plane button (itself below the heli), sharing the left edge', () => {
      const d = makeDozer();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      const plane = new PlaneManager();
      plane.setScreenSize(800, 600);
      expect(d.buttonX).toBe(plane.buttonX);
      expect(d.buttonX).toBe(heli.buttonX);
      expect(d.buttonY).toBeGreaterThan(plane.buttonY);
      expect(plane.buttonY).toBeGreaterThan(heli.buttonY);
    });

    it('keeps all three button touch targets from overlapping on any screen', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480]]) {
        const heli = new HelicopterManager();
        heli.setScreenSize(w, h);
        const plane = new PlaneManager();
        plane.setScreenSize(w, h);
        const d = new BulldozerManager();
        d.setScreenSize(w, h);
        const buttons = [
          { x: heli.buttonX, y: heli.buttonY, r: heli.buttonRadius },
          { x: plane.buttonX, y: plane.buttonY, r: plane.buttonRadius },
          { x: d.buttonX, y: d.buttonY, r: d.buttonRadius },
        ];
        for (let i = 0; i < buttons.length; i++) {
          for (let j = i + 1; j < buttons.length; j++) {
            const a = buttons[i];
            const b = buttons[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            // Each button uses a 1.25× touch radius (see buttonHitTest).
            expect(dist).toBeGreaterThanOrEqual((a.r + b.r) * 1.25);
          }
        }
      }
    });

    it('keeps all three buttons fully on-screen, including short/landscape viewports', () => {
      // Landscape phones are realistic for a full-screen toddler game; the third
      // (lowest) button must not be clipped off the bottom.
      for (const [w, h] of [[667, 375], [568, 320], [812, 375], [844, 390], [375, 667], [320, 480]]) {
        const heli = new HelicopterManager();
        heli.setScreenSize(w, h);
        const plane = new PlaneManager();
        plane.setScreenSize(w, h);
        const d = new BulldozerManager();
        d.setScreenSize(w, h);
        for (const btn of [
          { x: heli.buttonX, y: heli.buttonY, r: heli.buttonRadius },
          { x: plane.buttonX, y: plane.buttonY, r: plane.buttonRadius },
          { x: d.buttonX, y: d.buttonY, r: d.buttonRadius },
        ]) {
          const reach = btn.r * 1.25; // touch target must stay within the viewport
          expect(btn.y - reach).toBeGreaterThanOrEqual(0);
          expect(btn.y + reach).toBeLessThanOrEqual(h);
          expect(btn.x - reach).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('pushing + crushing', () => {
    it('does nothing and holds position when there are no balloons', () => {
      const d = makeDozer();
      d.spawn();
      const x0 = d.x;
      const y0 = d.y;
      for (let i = 0; i < 60; i++) d.update(1 / 60, [], noop);
      expect(d.x).toBeCloseTo(x0, 5);
      expect(d.y).toBeCloseTo(y0, 5);
    });

    it('shoves a left-side balloon into the left wall and freezes it', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(200, 300, true, 56, 70, 99); // many layers: never pops
      run(d, [t], (x) => (x as FakeTarget).crush(), () => t.x <= t.radiusX + BULLDOZER_PIN_SLACK + 1, 600);
      expect(t.x).toBeLessThanOrEqual(t.radiusX + BULLDOZER_PIN_SLACK + 1);
      expect(t.dragged).toBe(true); // held while being shoved
    });

    it('shoves a right-side balloon into the right wall', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(600, 300, true, 56, 70, 99);
      const wall = 800 - t.radiusX - BULLDOZER_PIN_SLACK - 1;
      run(d, [t], (x) => (x as FakeTarget).crush(), () => t.x >= wall, 600);
      expect(t.x).toBeGreaterThanOrEqual(wall);
      expect(t.dragged).toBe(true); // held while being shoved
    });

    it('crushes a pinned balloon in rhythmic bites spaced by the crush interval', () => {
      const d = makeDozer();
      // Many layers so it never pops — lets us observe several spaced bites.
      const t = new FakeTarget(250, 300, true, 56, 70, 99);
      d.spawn();
      const crushFrames: number[] = [];
      for (let f = 0; f < 700 && crushFrames.length < 4; f++) {
        d.update(1 / 60, [t], () => crushFrames.push(f));
      }
      expect(crushFrames.length).toBeGreaterThanOrEqual(3);
      // Successive bites are gated by BULLDOZER_CRUSH_INTERVAL — not every frame.
      const expectedGap = BULLDOZER_CRUSH_INTERVAL * 60; // frames at dt = 1/60
      for (let i = 1; i < crushFrames.length; i++) {
        const gap = crushFrames[i] - crushFrames[i - 1];
        expect(gap).toBeGreaterThanOrEqual(expectedGap - 2);
        expect(gap).toBeLessThanOrEqual(expectedGap + 2);
      }
    });

    it('scoops a whole lane of balloons at once and crushes them all', () => {
      const d = makeDozer();
      d.spawn();
      // Three balloons at the same height on the right half — one rightward sweep
      // should catch all three together and wall-crush them.
      const lane = [
        new FakeTarget(450, 300, true, 56, 70, 1),
        new FakeTarget(550, 300, true, 56, 70, 1),
        new FakeTarget(650, 300, true, 56, 70, 1),
      ];
      let maxHeldAtOnce = 0;
      for (let f = 0; f < 1500 && lane.some((t) => t.alive); f++) {
        d.update(1 / 60, lane, (x) => (x as FakeTarget).crush());
        maxHeldAtOnce = Math.max(maxHeldAtOnce, lane.filter((t) => t.dragged).length);
      }
      expect(maxHeldAtOnce).toBe(3);           // all three caught simultaneously
      expect(lane.every((t) => !t.alive)).toBe(true); // and all crushed
    });

    it('only scoops balloons within the blade lane, not ones at a very different height', () => {
      const d = makeDozer();
      d.spawn();
      const inLane = new FakeTarget(500, 300, true, 56, 70, 1);
      const wayAbove = new FakeTarget(520, 40, true, 56, 70, 1); // far above the lane
      const targets = [inLane, wayAbove];
      // Run until the in-lane balloon is crushed.
      run(d, targets, (x) => (x as FakeTarget).crush(), () => !inLane.alive, 1500);
      expect(inLane.alive).toBe(false);
      // The far-away balloon should never have been frozen during that sweep.
      expect(wayAbove.dragged).toBe(false);
    });

    it('crushes a pinned multi-layer balloon until it pops', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(250, 300, true, 56, 70, 3);
      let crushes = 0;
      run(d, [t], (x) => { crushes++; (x as FakeTarget).crush(); }, () => !t.alive, 900);
      expect(crushes).toBeGreaterThanOrEqual(3);
      expect(t.alive).toBe(false);
    });

    it('fully pops a real multi-layer Balloon', () => {
      const d = makeDozer();
      d.spawn();
      const b = new Balloon(800, 600);
      b.x = 250;
      b.baseX = 250;
      b.y = 300;
      b.number = 3;
      run(d, [b], (x) => (x as Balloon).tap(), () => b.state === 'popping' || b.state === 'dead', 1200);
      expect(['popping', 'dead']).toContain(b.state);
    });

    it('moves on to another balloon after the first is crushed', () => {
      const d = makeDozer();
      d.spawn();
      const first = new FakeTarget(220, 280, true, 56, 70, 1);
      const second = new FakeTarget(560, 360, true, 56, 70, 1);
      const targets = [first, second];
      run(d, targets, (x) => (x as FakeTarget).crush(), () => !first.alive && !second.alive, 1500);
      expect(first.alive).toBe(false);
      expect(second.alive).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('clear() releases a held balloon and skips the cooldown', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(200, 300, true, 56, 70, 99);
      run(d, [t], (x) => (x as FakeTarget).crush(), () => t.dragged, 600);
      expect(t.dragged).toBe(true);
      d.clear();
      expect(t.dragged).toBe(false);
      expect(d.state).toBe('idle');
      expect(d.isAvailable).toBe(true);
    });

    it('releases a held balloon when its lifetime ends', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(200, 300, true, 56, 70, 99);
      run(d, [t], (x) => (x as FakeTarget).crush(), () => t.dragged, 600);
      expect(t.dragged).toBe(true);
      d.update(BULLDOZER_LIFETIME + 0.1, [t], noop);
      expect(d.state).toBe('cooldown');
      expect(t.dragged).toBe(false);
    });

    it('reset() returns to a fresh idle state and releases a held balloon', () => {
      const d = makeDozer();
      d.spawn();
      const t = new FakeTarget(200, 300, true, 56, 70, 99);
      run(d, [t], (x) => (x as FakeTarget).crush(), () => t.dragged, 600);
      expect(t.dragged).toBe(true);
      d.reset();
      expect(d.state).toBe('idle');
      expect(d.isAvailable).toBe(true);
      expect(t.dragged).toBe(false);
    });

    it('re-clamps an active bulldozer onto a shrunken screen', () => {
      const d = makeDozer(); // 800 x 600
      d.spawn();
      d.x = 760;
      d.y = 560;
      d.setScreenSize(400, 300);
      const half = d.size * 0.5;
      expect(d.x).toBeLessThanOrEqual(400 - half);
      expect(d.y).toBeLessThanOrEqual(300 - half);
      expect(d.x).toBeGreaterThanOrEqual(half);
      expect(d.y).toBeGreaterThanOrEqual(half);
    });
  });
});
