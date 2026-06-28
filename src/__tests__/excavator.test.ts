import { describe, it, expect } from 'vitest';
import { ExcavatorManager, GrabTarget, DownpourSource } from '../excavator';
import { Balloon } from '../balloon';
import {
  EXCAVATOR_REACH_MARGIN,
} from '../constants';

// Mutable stand-in for the rain cloud the excavator lives under. RainCloudManager
// satisfies DownpourSource structurally; the fake lets a test toggle the cloud on
// and off and place its downpour column wherever it likes.
class FakeCloud implements DownpourSource {
  isActive = true;
  alpha = 1;
  x = 400;
  rainHalfWidth = 130;
  cloudBaseY = 120;
}

// Lightweight stand-in for a balloon the excavator can grab and chomp. Mirrors the
// writable fields the manager mutates; `chomp()` decrements layers like Balloon.tap.
class FakeTarget implements GrabTarget {
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
  chomp(): void {
    this.layers -= 1;
    if (this.layers <= 0) this.alive = false;
  }
}

function make(w = 800, h = 600): ExcavatorManager {
  const ex = new ExcavatorManager();
  ex.setScreenSize(w, h);
  return ex;
}

const noop = () => {};

// Run the manager until `done` returns true or the frame cap is hit. Steady 1/60s.
function run(
  ex: ExcavatorManager,
  cloud: DownpourSource,
  balloons: GrabTarget[],
  onChomp: (b: GrabTarget) => void,
  done: () => boolean,
  maxFrames = 2000,
): number {
  let f = 0;
  for (; f < maxFrames; f++) {
    ex.update(1 / 60, cloud, balloons, onChomp);
    if (done()) break;
  }
  return f;
}

describe('ExcavatorManager', () => {
  describe('pairing with the rain cloud', () => {
    it('stays dormant and invisible while no cloud is out', () => {
      const ex = make();
      const cloud = new FakeCloud();
      cloud.isActive = false;
      cloud.alpha = 0;
      const b = new FakeTarget(cloud.x, 300, 1);
      for (let i = 0; i < 120; i++) ex.update(1 / 60, cloud, [b], noop);
      expect(ex.alpha).toBe(0);
      expect(ex.isActive).toBe(false);
      expect(b.loaded).toBe(false);
      expect(b.alive).toBe(true); // never touched
    });

    it('wakes beneath a freshly summoned cloud and mirrors its fade', () => {
      const ex = make();
      const cloud = new FakeCloud();
      cloud.x = 250;
      cloud.alpha = 0.5;
      ex.update(1 / 60, cloud, [], noop);
      expect(ex.isActive).toBe(true);
      expect(ex.alpha).toBe(0.5);          // alpha tracks the cloud
      expect(ex.x).toBeCloseTo(250, 0);    // pops in directly under the cloud
    });

    it('trundles along the floor to stay under the wandering cloud', () => {
      const ex = make();
      const cloud = new FakeCloud();
      cloud.x = 250;
      ex.update(1 / 60, cloud, [], noop); // wake under x=250
      cloud.x = 640;
      for (let i = 0; i < 240; i++) ex.update(1 / 60, cloud, [], noop);
      expect(ex.x).toBeCloseTo(640, 0);
    });

    it('rides at a fixed height near the bottom of the screen', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      expect(ex.y).toBeGreaterThan(600 * 0.7);
      expect(ex.y).toBeLessThan(600);
    });

    it('keeps the whole track base on-screen even chasing a cloud at the wall', () => {
      const ex = make();
      const cloud = new FakeCloud();
      cloud.x = 5; // hard against the left wall
      for (let i = 0; i < 240; i++) ex.update(1 / 60, cloud, [], noop);
      const half = ex.size * 0.46;
      expect(ex.x - half).toBeGreaterThanOrEqual(-1);
      cloud.x = 795;
      for (let i = 0; i < 240; i++) ex.update(1 / 60, cloud, [], noop);
      expect(ex.x + half).toBeLessThanOrEqual(800 + 1);
    });
  });

  describe('articulated arm (inverse kinematics)', () => {
    it('preserves the boom and stick lengths as the arm settles', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      for (let i = 0; i < 90; i++) ex.update(1 / 60, cloud, [], noop); // ease to the rest pose
      const boom = Math.hypot(ex.elbowX - ex.shoulderX, ex.elbowY - ex.shoulderY);
      const stick = Math.hypot(ex.bucketX - ex.elbowX, ex.bucketY - ex.elbowY);
      expect(boom).toBeCloseTo(ex.boomLen, 3);
      expect(stick).toBeCloseTo(ex.stickLen, 3);
    });

    it('bends the elbow upward (boom rises, stick descends to the bucket)', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      for (let i = 0; i < 90; i++) ex.update(1 / 60, cloud, [], noop);
      // The chosen IK solution keeps the elbow above the shoulder it pivots from.
      expect(ex.elbowY).toBeLessThan(ex.shoulderY);
    });
  });

  describe('grabbing and chomping balloons in the downpour', () => {
    it('reaches up, grabs a balloon under the cloud and pops it', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 1);
      let chomps = 0;
      run(ex, cloud, [b], (t) => { chomps++; (t as FakeTarget).chomp(); }, () => !b.alive, 600);
      expect(b.alive).toBe(false);
      expect(chomps).toBeGreaterThanOrEqual(1);
      expect(b.loaded).toBe(false); // released once popped
    });

    it('claims a held balloon (loaded) so nothing else can touch it', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 99); // many layers — stays gripped
      run(ex, cloud, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      expect(ex.isActive).toBe(true);
      // While gripped it rides the bucket, not its own drift.
      ex.update(1 / 60, cloud, [b], (t) => (t as FakeTarget).chomp());
      expect(b.x).toBeCloseTo(ex.bucketX, 5);
    });

    it('sheds a layer per chomp until a multi-layer balloon pops', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 4);
      let chomps = 0;
      run(ex, cloud, [b], (t) => { chomps++; (t as FakeTarget).chomp(); }, () => !b.alive, 800);
      expect(chomps).toBeGreaterThanOrEqual(4);
      expect(b.alive).toBe(false);
    });

    it('fully pops a real multi-layer Balloon held under the cloud', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new Balloon(800, 600);
      b.number = 3;
      b.x = cloud.x;
      b.baseX = b.x;
      b.y = 300;
      run(ex, cloud, [b], (t) => (t as Balloon).tap(), () => b.state === 'popping' || b.state === 'dead', 1200);
      expect(['popping', 'dead']).toContain(b.state);
    });

    it('ignores balloons outside the downpour column', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const out = new FakeTarget(cloud.x + cloud.rainHalfWidth + 220, 300, 99);
      for (let i = 0; i < 200; i++) ex.update(1 / 60, cloud, [out], noop);
      expect(out.loaded).toBe(false);
      expect(ex.gripping).toBe(false);
    });

    it('ignores balloons up by the cloud and those beyond arm reach', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const aboveBase = new FakeTarget(cloud.x, 60, 99);  // higher than the cloud base
      const tooHigh = new FakeTarget(cloud.x, 150, 99);   // in the column but out of reach
      for (let i = 0; i < 200; i++) ex.update(1 / 60, cloud, [aboveBase, tooHigh], noop);
      expect(aboveBase.loaded).toBe(false);
      expect(tooHigh.loaded).toBe(false);
      expect(ex.gripping).toBe(false);
    });

    it('skips balloons a finger or another vehicle already holds', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const dragged = new FakeTarget(cloud.x, 300, 99);
      dragged.dragged = true;
      for (let i = 0; i < 120; i++) ex.update(1 / 60, cloud, [dragged], noop);
      expect(dragged.loaded).toBe(false);
      expect(ex.gripping).toBe(false);
    });

    it('leaves non-draggable special balloons for the player (like the tractor)', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const special = new FakeTarget(cloud.x, 300, 1);
      special.isDraggable = false;
      for (let i = 0; i < 200; i++) ex.update(1 / 60, cloud, [special], noop);
      expect(special.loaded).toBe(false);
      expect(special.alive).toBe(true);
      expect(ex.gripping).toBe(false);
    });

    it('grabs the nearest in-reach balloon first when several are in the column', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const near = new FakeTarget(cloud.x, 350, 99);
      const far = new FakeTarget(cloud.x + 30, 300, 99);
      run(ex, cloud, [near, far], (t) => (t as FakeTarget).chomp(), () => near.loaded, 600);
      expect(near.loaded).toBe(true);
      expect(far.loaded).toBe(false);
    });
  });

  describe('reach gate constant', () => {
    it('never targets beyond the configured fraction of full reach', () => {
      // A balloon whose grab point sits just past the reach gate is left alone.
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const reach = ex.maxReach * EXCAVATOR_REACH_MARGIN;
      // Place it straight above the shoulder, just outside the reach radius.
      const ry = 70;
      const gy = ex.shoulderY - reach - 20;          // grab point this high
      const by = gy + 0.35 * ry;                     // balloon centre below the grab point
      const far = new FakeTarget(ex.shoulderX, by, 99, 56, ry);
      for (let i = 0; i < 200; i++) ex.update(1 / 60, cloud, [far], noop);
      expect(far.loaded).toBe(false);
    });

    it('does not fixate on a balloon inside the unreachable inner dead zone', () => {
      // On a wide viewport the two-link arm has a real inner dead zone (it cannot
      // fold past |boom − stick|). A balloon parked there must be skipped, not chased
      // forever at the expense of a reachable one farther out.
      const ex = make(2000, 600);
      const cloud = new FakeCloud();
      cloud.x = 1000;
      ex.update(1 / 60, cloud, [], noop);
      const minR = Math.abs(ex.boomLen - ex.stickLen);
      expect(minR).toBeGreaterThan(40); // the dead zone genuinely exists at this size
      // Dead-zone balloon: its grab point sits right on the shoulder (distance 0).
      const dead = new FakeTarget(ex.shoulderX, ex.shoulderY + 0.35 * 70, 99);
      // Reachable balloon out in the column, farther from the shoulder.
      const reachable = new FakeTarget(cloud.x + 40, 250, 99);
      run(ex, cloud, [dead, reachable], (t) => (t as FakeTarget).chomp(), () => reachable.loaded, 900);
      expect(reachable.loaded).toBe(true);
      expect(dead.loaded).toBe(false);
    });
  });

  describe('resize / narrow viewport', () => {
    it('keeps holding a balloon (and on-screen) across a shrinking resize', () => {
      const ex = make(800, 600);
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 99);
      run(ex, cloud, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.setScreenSize(400, 300);
      // The held balloon is kept (not dropped) and eases back fully on-screen.
      for (let i = 0; i < 60; i++) ex.update(1 / 60, cloud, [b], (t) => (t as FakeTarget).chomp());
      expect(b.loaded).toBe(true);
      expect(ex.isActive).toBe(true);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(400);
    });

    it('centres the body when it is wider than a tiny viewport', () => {
      const ex = make(80, 300);
      const cloud = new FakeCloud();
      cloud.x = 40;
      ex.update(1 / 60, cloud, [], noop);
      expect(ex.x).toBe(40); // screenWidth / 2 fallback when no band fits
    });
  });

  describe('lifecycle', () => {
    it('releases a held balloon when the cloud goes away', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 99);
      run(ex, cloud, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      cloud.isActive = false;
      cloud.alpha = 0;
      ex.update(1 / 60, cloud, [b], noop);
      expect(b.loaded).toBe(false);
      expect(ex.gripping).toBe(false);
      expect(ex.isActive).toBe(false);
    });

    it('clear() drops the held balloon and goes dormant', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 99);
      run(ex, cloud, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.clear();
      expect(b.loaded).toBe(false);
      expect(ex.isActive).toBe(false);
      expect(ex.alpha).toBe(0);
    });

    it('reset() drops the held balloon and returns to a fresh state', () => {
      const ex = make();
      const cloud = new FakeCloud();
      ex.update(1 / 60, cloud, [], noop);
      const b = new FakeTarget(cloud.x, 300, 99);
      run(ex, cloud, [b], (t) => (t as FakeTarget).chomp(), () => b.loaded, 600);
      expect(b.loaded).toBe(true);
      ex.reset();
      expect(b.loaded).toBe(false);
      expect(ex.isActive).toBe(false);
      expect(ex.alpha).toBe(0);
    });
  });
});
