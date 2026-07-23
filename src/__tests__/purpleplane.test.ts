import { describe, expect, it } from 'vitest';
import { PurplePlaneManager, SkywriterTarget } from '../purpleplane';
import { PURPLE_PLANE_LIFETIME, PURPLE_PLANE_MARK_CAP } from '../constants';

class FakeTarget implements SkywriterTarget {
  radiusX = 34;
  radiusY = 44;
  loaded = false;
  dragged = false;
  isDraggable = true;
  alive = true;

  constructor(public x: number, public y: number) {}

  hitTest(px: number, py: number): boolean {
    if (!this.alive) return false;
    return ((px - this.x) / this.radiusX) ** 2 + ((py - this.y) / this.radiusY) ** 2 <= 1;
  }
}

function make(): PurplePlaneManager {
  const plane = new PurplePlaneManager();
  plane.setScreenSize(800, 600);
  return plane;
}

function setStraightPass(plane: PurplePlaneManager): void {
  Object.assign(plane as any, {
    x: 300,
    y: 300,
    heading: 0,
    runAngle: 0,
    focusX: 400,
    focusY: 300,
    lastPuffX: 300,
    lastPuffY: 300,
  });
}

describe('PurplePlaneManager', () => {
  it('uses the sixth right-column slot and spawns as a separate plane', () => {
    const plane = make();
    expect(plane.buttonX).toBeGreaterThan(400);
    expect(plane.trySpawn(plane.buttonX, plane.buttonY)).toBe(true);
    expect(plane.isActive).toBe(true);
  });

  it('marks crossed balloons, then applies one delayed hit at turnaround', () => {
    const plane = make();
    plane.spawn();
    setStraightPass(plane);
    const target = new FakeTarget(320, 300);
    let hits = 0;
    plane.update(0.1, 400, 300, [target], () => { hits++; });
    expect(plane.markedCount).toBe(1);
    expect(hits).toBe(0);

    Object.assign(plane as any, { x: 534, y: 300, heading: 0 });
    plane.update(0.05, 400, 300, [target], () => { hits++; });
    expect(hits).toBe(1);
    expect(plane.markedCount).toBe(0);
    expect(plane.sparklePulse).toBeGreaterThan(0);
  });

  it('deduplicates and caps balloons marked during one pass', () => {
    const plane = make();
    plane.spawn();
    setStraightPass(plane);
    const targets = Array.from({ length: PURPLE_PLANE_MARK_CAP + 3 }, (_, i) =>
      new FakeTarget(315 + i, 300),
    );
    plane.update(0.1, 400, 300, targets, () => {});
    plane.update(0.01, 400, 300, targets, () => {});
    expect(plane.markedCount).toBe(PURPLE_PLANE_MARK_CAP);
  });

  it('skips claimed, dragged, and special balloons', () => {
    const plane = make();
    plane.spawn();
    setStraightPass(plane);
    const claimed = new FakeTarget(315, 300); claimed.loaded = true;
    const dragged = new FakeTarget(320, 300); dragged.dragged = true;
    const special = new FakeTarget(325, 300); special.isDraggable = false;
    plane.update(0.1, 400, 300, [claimed, dragged, special], () => {});
    expect(plane.markedCount).toBe(0);
  });

  it('ages trail puffs and clears transient state on lifecycle exits', () => {
    const plane = make();
    plane.spawn();
    setStraightPass(plane);
    plane.update(0.1, 400, 300, [], () => {});
    expect(plane.trail.length).toBeGreaterThan(0);
    plane.clear();
    expect(plane.trail).toHaveLength(0);

    plane.spawn();
    plane.update(PURPLE_PLANE_LIFETIME + 0.1, 400, 300, [], () => {});
    expect(plane.state).toBe('cooldown');
    expect(plane.trail).toHaveLength(0);
  });
});
