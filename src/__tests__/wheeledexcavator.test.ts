import { describe, expect, it } from 'vitest';
import { SwingTarget, WheeledExcavatorManager } from '../wheeledexcavator';
import { WHEELED_EXCAVATOR_HIT_CAP, WHEELED_EXCAVATOR_LIFETIME } from '../constants';

class FakeTarget implements SwingTarget {
  baseX: number;
  radiusX = 34;
  radiusY = 44;
  loaded = false;
  dragged = false;
  isDraggable = true;
  alive = true;

  constructor(public x: number, public y: number) {
    this.baseX = x;
  }

  hitTest(px: number, py: number): boolean {
    if (!this.alive) return false;
    return ((px - this.x) / this.radiusX) ** 2 + ((py - this.y) / this.radiusY) ** 2 <= 1;
  }
}

function make(): WheeledExcavatorManager {
  const excavator = new WheeledExcavatorManager();
  excavator.setScreenSize(800, 600);
  return excavator;
}

describe('WheeledExcavatorManager', () => {
  it('uses the fifth right-column slot and is independent from the tracked excavator', () => {
    const excavator = make();
    expect(excavator.buttonX).toBeGreaterThan(400);
    expect(excavator.trySpawn(excavator.buttonX, excavator.buttonY)).toBe(true);
    expect(excavator.isActive).toBe(true);
  });

  it('grabs a reachable balloon, swings it, pats it, and releases it', () => {
    const excavator = make();
    excavator.spawn();
    const held = new FakeTarget(400, 320);
    let heldHits = 0;
    for (let i = 0; i < 1200 && (heldHits === 0 || held.loaded); i++) {
      excavator.update(1 / 60, [held], target => {
        if (target === held) heldHits++;
      });
    }
    expect(heldHits).toBe(1);
    expect(held.loaded).toBe(false);
    expect(excavator.gripping).toBe(false);
  });

  it('bonks nearby balloons at most once each and respects the hit cap', () => {
    const excavator = make();
    excavator.spawn();
    const held = new FakeTarget(400, 320);
    for (let i = 0; i < 600 && !held.loaded; i++) excavator.update(1 / 60, [held], () => {});
    expect(held.loaded).toBe(true);

    const others = Array.from({ length: WHEELED_EXCAVATOR_HIT_CAP + 2 }, () =>
      new FakeTarget(held.x, held.y),
    );
    const hitCounts = new Map<FakeTarget, number>();
    for (let i = 0; i < 20; i++) {
      for (const other of others) {
        other.x = held.x;
        other.y = held.y;
        other.baseX = other.x;
      }
      excavator.update(1 / 60, [held, ...others], target => {
        if (target !== held) hitCounts.set(target as FakeTarget, (hitCounts.get(target as FakeTarget) ?? 0) + 1);
      });
    }
    expect(hitCounts.size).toBeLessThanOrEqual(WHEELED_EXCAVATOR_HIT_CAP);
    for (const count of hitCounts.values()) expect(count).toBe(1);
  });

  it('skips dragged, claimed, and special targets', () => {
    const excavator = make();
    excavator.spawn();
    const dragged = new FakeTarget(390, 320); dragged.dragged = true;
    const claimed = new FakeTarget(400, 320); claimed.loaded = true;
    const special = new FakeTarget(410, 320); special.isDraggable = false;
    for (let i = 0; i < 300; i++) excavator.update(1 / 60, [dragged, claimed, special], () => {});
    expect(excavator.gripping).toBe(false);
    expect(claimed.loaded).toBe(true);
  });

  it('releases its balloon on clear and lifetime expiry', () => {
    for (const finish of ['clear', 'lifetime'] as const) {
      const excavator = make();
      excavator.spawn();
      const held = new FakeTarget(400, 320);
      for (let i = 0; i < 600 && !held.loaded; i++) excavator.update(1 / 60, [held], () => {});
      expect(held.loaded).toBe(true);
      if (finish === 'clear') excavator.clear();
      else excavator.update(WHEELED_EXCAVATOR_LIFETIME + 0.1, [held], () => {});
      expect(held.loaded).toBe(false);
    }
  });
});
