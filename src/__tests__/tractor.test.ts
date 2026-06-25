import { describe, it, expect } from 'vitest';
import { TractorManager, LoadTarget } from '../tractor';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { BulldozerManager } from '../bulldozer';
import { Balloon } from '../balloon';
import {
  TRACTOR_LIFETIME,
  TRACTOR_COOLDOWN,
  TRACTOR_CAPACITY,
} from '../constants';

// Lightweight stand-in for a balloon the tractor can carry and process. Mirrors
// the writable fields the manager mutates; `process()` decrements like Balloon.tap.
class FakeTarget implements LoadTarget {
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
  process(): void {
    this.layers -= 1;
    if (this.layers <= 0) this.alive = false;
  }
}

function makeTractor(): TractorManager {
  const t = new TractorManager();
  t.setScreenSize(800, 600);
  return t;
}

const noop = () => {};

// Run the manager until `done` returns true or the frame cap is hit. Returns the
// number of frames actually run (dt is a steady 1/60s).
function run(
  t: TractorManager,
  targets: LoadTarget[],
  onProcess: (b: LoadTarget) => void,
  done: () => boolean,
  maxFrames = 1500,
): number {
  let f = 0;
  for (; f < maxFrames; f++) {
    t.update(1 / 60, targets, onProcess);
    if (done()) break;
  }
  return f;
}

describe('TractorManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const t = makeTractor();
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
      expect(t.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const t = makeTractor();
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(true);
      expect(t.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const t = makeTractor();
      expect(t.trySpawn(600, 400)).toBe(false);
      expect(t.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const t = makeTractor();
      t.spawn();
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const t = makeTractor();
      t.spawn();
      t.update(TRACTOR_LIFETIME + 0.1, [], noop);
      expect(t.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const t = makeTractor();
      t.spawn();
      t.update(TRACTOR_LIFETIME + 0.1, [], noop);
      expect(t.isAvailable).toBe(false);
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(false);
      t.update(TRACTOR_COOLDOWN + 0.1, [], noop);
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const t = makeTractor();
      t.spawn();
      t.update(TRACTOR_LIFETIME + 0.01, [], noop); // -> cooldown
      const start = t.cooldownProgress;
      t.update(TRACTOR_COOLDOWN / 2, [], noop);
      const mid = t.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });
  });

  describe('spawn button placement', () => {
    it('stacks below the bulldozer button, sharing the left edge', () => {
      const t = makeTractor();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      const plane = new PlaneManager();
      plane.setScreenSize(800, 600);
      const dozer = new BulldozerManager();
      dozer.setScreenSize(800, 600);
      expect(t.buttonX).toBe(dozer.buttonX);
      expect(t.buttonX).toBe(heli.buttonX);
      expect(t.buttonY).toBeGreaterThan(dozer.buttonY);
      expect(dozer.buttonY).toBeGreaterThan(plane.buttonY);
      expect(plane.buttonY).toBeGreaterThan(heli.buttonY);
    });

    it('keeps all four button touch targets from overlapping on any screen', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [480, 300]]) {
        const buttons = makeAllButtons(w, h);
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

    it('keeps all four buttons fully on-screen, including short/landscape viewports', () => {
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
      const t = makeTractor();
      t.spawn();
      const y0 = t.y;
      for (let i = 0; i < 120; i++) t.update(1 / 60, [], noop);
      expect(t.y).toBe(y0);                 // x-axis only — y never changes
      expect(t.y).toBeGreaterThan(600 * 0.7);
      expect(t.y).toBeLessThan(600);
    });

    it('moves back and forth, reversing at the edges while staying on-screen', () => {
      const t = makeTractor();
      t.spawn();
      const x0 = t.x;
      t.update(1 / 60, [], noop);
      t.update(1 / 60, [], noop);
      expect(t.x).toBeGreaterThan(x0);      // sets off to the right
      expect(t.dir).toBe(1);

      const rigOnScreen = () => {
        expect(t.trailerCenterX - t.bedHalfWidth).toBeGreaterThanOrEqual(-1);
        expect(t.x + t.size * 0.48).toBeLessThanOrEqual(800 + 1);
      };

      // Run until it reverses at the right wall.
      let reversed = false;
      for (let i = 0; i < 1200 && !reversed; i++) {
        t.update(1 / 60, [], noop);
        rigOnScreen();
        if (t.dir === -1) reversed = true;
      }
      expect(reversed).toBe(true);

      // Now it heads back left.
      const xAtTurn = t.x;
      for (let i = 0; i < 30; i++) t.update(1 / 60, [], noop);
      expect(t.x).toBeLessThan(xAtTurn);
    });
  });

  describe('loading + processing', () => {
    it('scoops up a balloon that touches the trailer and carries it on the bed', () => {
      const t = makeTractor();
      t.spawn();
      // Sit a balloon over the bed at bed-surface height (many layers: never pops).
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 70 * 0.85, 99);
      t.update(1 / 60, [b], noop);
      expect(b.loaded).toBe(true);
      // It is held on the bed surface, not left to drift.
      expect(b.y).toBeCloseTo(t.bedSurfaceY - b.radiusY * 0.85, 5);
    });

    it('does not scoop balloons that are not touching the bed (too high up)', () => {
      const t = makeTractor();
      t.spawn();
      const high = new FakeTarget(t.trailerCenterX, 80, 99); // far above the bed
      for (let i = 0; i < 120; i++) t.update(1 / 60, [high], noop);
      expect(high.loaded).toBe(false);
    });

    it('ignores special (non-draggable) balloons and balloons held elsewhere', () => {
      const t = makeTractor();
      t.spawn();
      const special = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 60, 1);
      special.isDraggable = false;
      const held = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 60, 1);
      held.dragged = true;
      t.update(1 / 60, [special, held], noop);
      expect(special.loaded).toBe(false);
      expect(held.loaded).toBe(false);
    });

    it('never holds more than the bed capacity at once', () => {
      const t = makeTractor();
      t.spawn();
      const restY = t.bedSurfaceY - 70 * 0.85;
      const cx = t.trailerCenterX;
      const cargo = [
        new FakeTarget(cx - 60, restY, 99),
        new FakeTarget(cx - 20, restY, 99),
        new FakeTarget(cx + 20, restY, 99),
        new FakeTarget(cx + 60, restY, 99),
      ];
      for (let i = 0; i < 10; i++) t.update(1 / 60, cargo, noop);
      expect(t.loadedCount).toBe(TRACTOR_CAPACITY);
      expect(cargo.filter((c) => c.loaded).length).toBe(TRACTOR_CAPACITY);
    });

    it('sheds a layer at a time from a loaded balloon until it pops', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 70 * 0.85, 3);
      let processed = 0;
      run(t, [b], (x) => { processed++; (x as FakeTarget).process(); }, () => !b.alive, 600);
      expect(processed).toBeGreaterThanOrEqual(3);
      expect(b.alive).toBe(false);
      // The popped balloon is dropped on the next frame (it no longer hit-tests).
      t.update(1 / 60, [b], noop);
      expect(b.loaded).toBe(false); // released once popped
    });

    it('fully pops a real multi-layer Balloon placed on the bed', () => {
      const t = makeTractor();
      t.spawn();
      const b = new Balloon(800, 600);
      b.number = 3;
      b.x = t.trailerCenterX;
      b.baseX = b.x;
      b.y = t.bedSurfaceY - b.radiusY * 0.85;
      run(t, [b], (x) => (x as Balloon).tap(), () => b.state === 'popping' || b.state === 'dead', 1200);
      expect(['popping', 'dead']).toContain(b.state);
    });
  });

  describe('drag-and-drop', () => {
    it('accepts a balloon dropped onto the trailer', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 40, 2);
      expect(t.tryDrop(b)).toBe(true);
      expect(b.loaded).toBe(true);
    });

    it('rejects a drop nowhere near the trailer', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, 80, 2); // way above the bed
      expect(t.tryDrop(b)).toBe(false);
      expect(b.loaded).toBe(false);
    });

    it('rejects drops when inactive, when full, and for non-draggable balloons', () => {
      const t = makeTractor();
      const before = new FakeTarget(0, 0, 1);
      expect(t.tryDrop(before)).toBe(false); // not spawned yet

      t.spawn();
      const special = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 40, 1);
      special.isDraggable = false;
      expect(t.tryDrop(special)).toBe(false);

      for (let i = 0; i < TRACTOR_CAPACITY; i++) {
        const ok = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 40, 99);
        expect(t.tryDrop(ok)).toBe(true);
      }
      const overflow = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 40, 1);
      expect(t.tryDrop(overflow)).toBe(false); // bed full
    });
  });

  describe('lifecycle', () => {
    it('clear() releases held balloons and skips the cooldown', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 70 * 0.85, 99);
      t.update(1 / 60, [b], noop);
      expect(b.loaded).toBe(true);
      t.clear();
      expect(b.loaded).toBe(false);
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
    });

    it('releases held balloons when its lifetime ends', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 70 * 0.85, 99);
      t.update(1 / 60, [b], noop);
      expect(b.loaded).toBe(true);
      t.update(TRACTOR_LIFETIME + 0.1, [b], noop);
      expect(t.state).toBe('cooldown');
      expect(b.loaded).toBe(false);
    });

    it('reset() returns to a fresh idle state and releases held balloons', () => {
      const t = makeTractor();
      t.spawn();
      const b = new FakeTarget(t.trailerCenterX, t.bedSurfaceY - 70 * 0.85, 99);
      t.update(1 / 60, [b], noop);
      expect(b.loaded).toBe(true);
      t.reset();
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
      expect(b.loaded).toBe(false);
    });

    it('re-clamps an active tractor onto a shrunken screen', () => {
      const t = makeTractor(); // 800 x 600
      t.spawn();
      t.x = 760;
      t.setScreenSize(400, 300);
      expect(t.x + t.size * 0.48).toBeLessThanOrEqual(400 + 1);
      expect(t.trailerCenterX - t.bedHalfWidth).toBeGreaterThanOrEqual(-1);
    });
  });
});

// Build the four vehicle spawn buttons at a given viewport for placement checks.
function makeAllButtons(w: number, h: number): Array<{ x: number; y: number; r: number }> {
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
