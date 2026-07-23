import { describe, expect, it } from 'vitest';
import { JeepManager, JeepTarget } from '../jeep';
import { JEEP_COOLDOWN, JEEP_LIFETIME } from '../constants';

class FakeTarget implements JeepTarget {
  baseX: number;
  radiusX = 36;
  radiusY = 46;
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

function make(): JeepManager {
  const jeep = new JeepManager();
  jeep.setScreenSize(800, 600);
  return jeep;
}

describe('JeepManager', () => {
  it('uses the third right-column slot and follows the summon lifecycle', () => {
    const jeep = make();
    expect(jeep.buttonX).toBeGreaterThan(400);
    expect(jeep.trySpawn(jeep.buttonX, jeep.buttonY)).toBe(true);
    expect(jeep.isActive).toBe(true);
    jeep.update(JEEP_LIFETIME + 0.1, [], () => {});
    expect(jeep.state).toBe('cooldown');
    jeep.update(JEEP_COOLDOWN + 0.1, [], () => {});
    expect(jeep.state).toBe('idle');
  });

  it('can be grabbed and driven horizontally without snapping', () => {
    const jeep = make();
    jeep.spawn();
    const start = jeep.x;
    expect(jeep.tryGrab(7, jeep.x, jeep.y)).toBe(true);
    expect(jeep.drag(7, jeep.x - 120, jeep.y - 200)).toBe(true);
    expect(jeep.x).toBeLessThan(start - 80);
    expect(jeep.y).toBeGreaterThan(500);
    expect(jeep.release(7)).toBe(true);
  });

  it('bonks once per contact and can bonk again after separation', () => {
    const jeep = make();
    jeep.spawn();
    const target = new FakeTarget(jeep.bumperX, jeep.bumperY);
    let bonks = 0;
    jeep.update(0, [target], () => { bonks++; });
    jeep.update(0, [target], () => { bonks++; });
    expect(bonks).toBe(1);
    target.x = target.baseX = 100;
    jeep.update(0, [target], () => { bonks++; });
    target.x = target.baseX = jeep.bumperX;
    jeep.update(0, [target], () => { bonks++; });
    expect(bonks).toBe(2);
  });

  it('sweeps the bumper path so a fast drag cannot tunnel through a balloon', () => {
    const jeep = make();
    jeep.spawn();
    const target = new FakeTarget(420, jeep.bumperY);
    let bonks = 0;
    expect(jeep.tryGrab(3, jeep.x, jeep.y)).toBe(true);
    jeep.drag(3, 180, jeep.y);
    jeep.update(0, [target], () => { bonks++; });
    expect(bonks).toBe(1);
  });

  it('leaves claimed, dragged, and special balloons alone', () => {
    const jeep = make();
    jeep.spawn();
    const claimed = new FakeTarget(jeep.bumperX, jeep.bumperY); claimed.loaded = true;
    const dragged = new FakeTarget(jeep.bumperX, jeep.bumperY); dragged.dragged = true;
    const special = new FakeTarget(jeep.bumperX, jeep.bumperY); special.isDraggable = false;
    let bonks = 0;
    jeep.update(0, [claimed, dragged, special], () => { bonks++; });
    expect(bonks).toBe(0);
  });

  it('releases pointer ownership when cleared', () => {
    const jeep = make();
    jeep.spawn();
    expect(jeep.tryGrab(1, jeep.x, jeep.y)).toBe(true);
    jeep.clear();
    expect(jeep.drag(1, 100, 100)).toBe(false);
    expect(jeep.state).toBe('idle');
  });
});
