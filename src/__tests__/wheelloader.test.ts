import { describe, it, expect } from 'vitest';
import { WheelLoaderManager, ShoveTarget, PopperPoint } from '../wheelloader';
import { RainCloudManager } from '../raincloud';
import { Balloon } from '../balloon';
import {
  WHEELLOADER_LIFETIME,
  WHEELLOADER_COOLDOWN,
  WHEELLOADER_BUCKET_UP,
} from '../constants';

// Lightweight stand-in for a balloon the loader can shove. Mirrors the writable
// position fields plus the drag/loaded flags and a floating hitTest, so the manager's
// grab / shove / release logic can be exercised without the full Balloon.
class FakeTarget implements ShoveTarget {
  radiusX = 30;
  radiusY = 36;
  dragged = false;
  loaded = false;
  baseX: number;
  live = true; // false = popped/gone, so hitTest reports not-poppable
  constructor(public x: number, public y: number) {
    this.baseX = x;
  }
  hitTest(px: number, py: number): boolean {
    if (!this.live) return false;
    const dx = (px - this.x) / this.radiusX;
    const dy = (py - this.y) / this.radiusY;
    return dx * dx + dy * dy <= 1;
  }
}

function make(w = 800, h = 600): WheelLoaderManager {
  const l = new WheelLoaderManager();
  l.setScreenSize(w, h);
  return l;
}

// A reachable balloon sits at the bucket's catch height. Build one at a given x for a
// spawned loader.
function reachableY(l: WheelLoaderManager): number {
  return l.bucketY;
}

function step(l: WheelLoaderManager, balloons: ShoveTarget[], poppers: PopperPoint[], frames: number): void {
  for (let i = 0; i < frames; i++) l.update(1 / 60, balloons, poppers);
}

describe('WheelLoaderManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const l = make();
      expect(l.state).toBe('idle');
      expect(l.isAvailable).toBe(true);
      expect(l.isActive).toBe(false);
    });

    it('spawns when its button is tapped', () => {
      const l = make();
      expect(l.trySpawn(l.buttonX, l.buttonY)).toBe(true);
      expect(l.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const l = make();
      expect(l.trySpawn(400, 300)).toBe(false);
      expect(l.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const l = make();
      l.spawn();
      expect(l.trySpawn(l.buttonX, l.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const l = make();
      l.spawn();
      l.update(WHEELLOADER_LIFETIME + 0.1, [], []);
      expect(l.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const l = make();
      l.spawn();
      l.update(WHEELLOADER_LIFETIME + 0.1, [], []);
      expect(l.isAvailable).toBe(false);
      expect(l.trySpawn(l.buttonX, l.buttonY)).toBe(false);
      l.update(WHEELLOADER_COOLDOWN + 0.1, [], []);
      expect(l.state).toBe('idle');
      expect(l.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const l = make();
      l.spawn();
      l.update(WHEELLOADER_LIFETIME + 0.01, [], []); // -> cooldown
      const start = l.cooldownProgress;
      l.update(WHEELLOADER_COOLDOWN / 2, [], []);
      const mid = l.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });

    it('fades in on spawn and out at end of life', () => {
      const l = make();
      l.spawn();
      expect(l.alpha).toBe(0);
      l.update(0.3, [], []);
      expect(l.alpha).toBeCloseTo(1, 1);
      l.update(WHEELLOADER_LIFETIME - 0.3 - 0.6, [], []); // 0.6s of life left
      expect(l.alpha).toBeCloseTo(0.5, 1);
    });
  });

  describe('spawn button placement (2nd in the right effect column)', () => {
    it('sits on the right edge, below the rain-cloud button', () => {
      const l = make(800, 600);
      const rain = new RainCloudManager();
      rain.setScreenSize(800, 600);
      expect(l.buttonX).toBe(rain.buttonX);
      expect(l.buttonX).toBeGreaterThan(400); // right half of the screen
      expect(l.buttonY).toBeGreaterThan(rain.buttonY);
    });

    it('keeps both effect-button touch targets on-screen and clear of each other', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [667, 375], [480, 300]]) {
        const l = make(w, h);
        const rain = new RainCloudManager();
        rain.setScreenSize(w, h);
        const btns = [
          { x: rain.buttonX, y: rain.buttonY, r: rain.buttonRadius },
          { x: l.buttonX, y: l.buttonY, r: l.buttonRadius },
        ];
        for (const b of btns) {
          const reach = b.r * 1.25;
          expect(b.y - reach).toBeGreaterThanOrEqual(0);
          expect(b.y + reach).toBeLessThanOrEqual(h);
          expect(b.x + reach).toBeLessThanOrEqual(w);
        }
        const dist = Math.hypot(btns[0].x - btns[1].x, btns[0].y - btns[1].y);
        expect(dist).toBeGreaterThanOrEqual((btns[0].r + btns[1].r) * 1.25);
      }
    });
  });

  describe('movement', () => {
    it('rides at a fixed height near the bottom of the screen', () => {
      const l = make();
      l.spawn();
      const y0 = l.y;
      step(l, [], [], 120);
      expect(l.y).toBe(y0);
      expect(l.y).toBeGreaterThan(600 * 0.6);
      expect(l.y).toBeLessThan(600);
    });

    it('eases back toward centre when there is no popper to shove toward', () => {
      const l = make();
      l.spawn();
      (l as unknown as { x: number }).x = 120; // knocked off to the left
      const b = new FakeTarget(120, reachableY(l)); // a reachable balloon, but no popper
      step(l, [b], [], 180);
      expect(Math.abs(l.x - 400)).toBeLessThan(40); // drifted back to centre
      expect(b.dragged).toBe(false);                // never grabbed it
      expect(b.x).toBeCloseTo(120, 5);              // and never moved it
    });
  });

  describe('shoving balloons toward a popper', () => {
    it('shoves a balloon toward a popper off to its right', () => {
      const l = make();
      l.spawn();
      const b = new FakeTarget(300, reachableY(l));
      const popper: PopperPoint = { x: 700, y: 500 };
      const startX = b.x;
      step(l, [b], [popper], 180);
      expect(b.x).toBeGreaterThan(startX + 40); // pushed toward the popper on the right
      expect(l.facing).toBe(1);
    });

    it('shoves a balloon toward a popper off to its left', () => {
      const l = make();
      l.spawn();
      const b = new FakeTarget(500, reachableY(l));
      const popper: PopperPoint = { x: 100, y: 500 };
      const startX = b.x;
      step(l, [b], [popper], 180);
      expect(b.x).toBeLessThan(startX - 40); // pushed toward the popper on the left
      expect(l.facing).toBe(-1);
    });

    it('freezes the balloon it is shoving and releases it once delivered', () => {
      const l = make();
      l.spawn();
      const b = new FakeTarget(360, reachableY(l));
      const popper: PopperPoint = { x: 520, y: 500 };
      // Run until the balloon has been pushed within delivery range of the popper.
      let everDragged = false;
      for (let i = 0; i < 300; i++) {
        l.update(1 / 60, [b], [popper]);
        if (b.dragged) everDragged = true;
      }
      expect(everDragged).toBe(true);                 // it did claim/freeze the balloon
      expect(Math.abs(b.x - popper.x)).toBeLessThan(l.size); // ended up at the popper
      expect(b.dragged).toBe(false);                  // and was released on delivery
    });

    it('leaves a balloon already sitting at a popper alone', () => {
      const l = make();
      l.spawn();
      const popper: PopperPoint = { x: 400, y: 500 };
      const b = new FakeTarget(400, reachableY(l)); // already right at the popper
      step(l, [b], [popper], 120);
      expect(b.dragged).toBe(false);
      expect(b.x).toBeCloseTo(400, 5);
    });

    it('ignores a balloon risen out of the bucket’s reach', () => {
      const l = make();
      l.spawn();
      const high = new FakeTarget(300, l.bucketY - l.size * WHEELLOADER_BUCKET_UP - 400);
      const popper: PopperPoint = { x: 700, y: 500 };
      const startX = high.x;
      step(l, [high], [popper], 120);
      expect(high.dragged).toBe(false);
      expect(high.x).toBeCloseTo(startX, 5);
    });

    it('ignores balloons the tractor / excavator have loaded', () => {
      const l = make();
      l.spawn();
      const loaded = new FakeTarget(300, reachableY(l));
      loaded.loaded = true;
      const popper: PopperPoint = { x: 700, y: 500 };
      const startX = loaded.x;
      step(l, [loaded], [popper], 120);
      expect(loaded.x).toBeCloseTo(startX, 5);
    });

    it('does not grab a balloon the player is already dragging', () => {
      const l = make();
      l.spawn();
      const held = new FakeTarget(300, reachableY(l));
      held.dragged = true; // player has it
      const popper: PopperPoint = { x: 700, y: 500 };
      const startX = held.x;
      step(l, [held], [popper], 120);
      expect(held.x).toBeCloseTo(startX, 5); // the loader never shoved it
    });

    it('does not shove while idle or in cooldown', () => {
      const l = make();
      const popper: PopperPoint = { x: 700, y: 500 };
      const idle = new FakeTarget(300, l.bucketY);
      step(l, [idle], [popper], 60);
      expect(idle.dragged).toBe(false);
      expect(idle.x).toBeCloseTo(300, 5);

      l.spawn();
      l.update(WHEELLOADER_LIFETIME + 0.1, [], []); // -> cooldown, releasing anything held
      const cd = new FakeTarget(300, l.bucketY);
      step(l, [cd], [popper], 30);
      expect(cd.dragged).toBe(false);
      expect(cd.x).toBeCloseTo(300, 5);
    });

    it('delivers a real balloon under the popper and lets it rise again afterwards', () => {
      const l = make();
      l.spawn();
      const b = new Balloon(800, 600);
      b.x = b.baseX = 300;
      b.y = l.bucketY;
      const popper: PopperPoint = { x: 560, y: 500 };
      // Shove it over; while frozen (dragged) it should not rise.
      const yWhileHeld: number[] = [];
      for (let i = 0; i < 200; i++) {
        b.update(1 / 60);
        l.update(1 / 60, [b], [popper]);
        if (b.dragged) yWhileHeld.push(b.y);
      }
      expect(b.x).toBeGreaterThan(300 + 40);          // moved toward the popper
      // Frozen balloons don't drift up: the held-frame heights barely change.
      if (yWhileHeld.length > 1) {
        const spread = Math.max(...yWhileHeld) - Math.min(...yWhileHeld);
        expect(spread).toBeLessThan(5);
      }
      expect(b.dragged).toBe(false);                  // released after delivery
    });
  });

  describe('lifecycle', () => {
    it('releases a held balloon and skips the cooldown on clear()', () => {
      const l = make();
      l.spawn();
      const b = new FakeTarget(360, reachableY(l));
      const popper: PopperPoint = { x: 560, y: 500 };
      step(l, [b], [popper], 40); // get it grabbing/shoving
      l.clear();
      expect(l.state).toBe('idle');
      expect(l.isAvailable).toBe(true);
      expect(l.alpha).toBe(0);
      expect(b.dragged).toBe(false); // let go of the balloon
    });

    it('reset() returns to a fresh idle state facing right', () => {
      const l = make();
      l.spawn();
      const b = new FakeTarget(500, reachableY(l));
      step(l, [b], [{ x: 100, y: 500 }], 30); // face left while working
      l.reset();
      expect(l.state).toBe('idle');
      expect(l.alpha).toBe(0);
      expect(l.facing).toBe(1);
      expect(b.dragged).toBe(false);
    });

    it('keeps the loader on-screen across a shrinking resize', () => {
      const l = make(800, 600);
      l.spawn();
      const b = new FakeTarget(780, 300);
      step(l, [b], [{ x: 780, y: 500 }], 90); // drive toward the right wall
      l.setScreenSize(400, 300);
      expect(l.x + l.size * 0.52).toBeLessThanOrEqual(400 + 1);
      step(l, [b], [{ x: 780, y: 500 }], 60);
      expect(l.x + l.size * 0.52).toBeLessThanOrEqual(400 + 1);
    });
  });
});
