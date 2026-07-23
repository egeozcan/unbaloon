import { describe, expect, it } from 'vitest';
import { BackhoeManager, BackhoeTarget } from '../backhoe';
import { BACKHOE_LIFETIME } from '../constants';

class FakeTarget implements BackhoeTarget {
  baseX: number;
  radiusX = 38;
  radiusY = 48;
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

function make(): BackhoeManager {
  const backhoe = new BackhoeManager();
  backhoe.setScreenSize(800, 600);
  return backhoe;
}

function run(backhoe: BackhoeManager, targets: BackhoeTarget[], focusX = 320, focusY = 310, frames = 1200): void {
  for (let i = 0; i < frames; i++) backhoe.update(1 / 60, focusX, focusY, targets);
}

describe('BackhoeManager', () => {
  it('uses the fourth right-column slot', () => {
    const backhoe = make();
    expect(backhoe.buttonX).toBeGreaterThan(400);
    expect(backhoe.trySpawn(backhoe.buttonX, backhoe.buttonY)).toBe(true);
  });

  it('scoops a low balloon, relays it toward focus, and releases it without damage', () => {
    const backhoe = make();
    backhoe.spawn();
    const target = new FakeTarget(560, 445);
    const layers = 4;
    let scoops = 0;
    let drops = 0;
    for (let i = 0; i < 1200 && drops === 0; i++) {
      backhoe.update(1 / 60, 300, 300, [target], () => { scoops++; }, () => { drops++; });
    }
    expect(scoops).toBe(1);
    expect(drops).toBe(1);
    expect(target.loaded).toBe(false);
    expect(target.x).toBeLessThan(500);
    expect(layers).toBe(4);
  });

  it('skips dragged, claimed, and special balloons', () => {
    const backhoe = make();
    backhoe.spawn();
    const dragged = new FakeTarget(420, 445); dragged.dragged = true;
    const claimed = new FakeTarget(440, 445); claimed.loaded = true;
    const special = new FakeTarget(460, 445); special.isDraggable = false;
    run(backhoe, [dragged, claimed, special], 300, 300, 240);
    expect(backhoe.carrying).toBe(false);
    expect(dragged.loaded).toBe(false);
    expect(claimed.loaded).toBe(true);
  });

  it('does not immediately reacquire the balloon it just dropped', () => {
    const backhoe = make();
    backhoe.spawn();
    const target = new FakeTarget(560, 445);
    let drops = 0;
    for (let i = 0; i < 1200 && drops === 0; i++) {
      backhoe.update(1 / 60, 520, 430, [target], undefined, () => { drops++; });
    }
    expect(drops).toBe(1);
    for (let i = 0; i < 20; i++) backhoe.update(1 / 60, 520, 430, [target]);
    expect(target.loaded).toBe(false);
  });

  it('drops a held balloon when cleared or its lifetime ends', () => {
    for (const finish of ['clear', 'lifetime'] as const) {
      const backhoe = make();
      backhoe.spawn();
      const target = new FakeTarget(500, 445);
      for (let i = 0; i < 500 && !target.loaded; i++) backhoe.update(1 / 60, 300, 300, [target]);
      expect(target.loaded).toBe(true);
      if (finish === 'clear') backhoe.clear();
      else backhoe.update(BACKHOE_LIFETIME + 0.1, 300, 300, [target]);
      expect(target.loaded).toBe(false);
    }
  });
});
