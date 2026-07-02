import { describe, it, expect } from 'vitest';
import { FiretruckManager, SprayTarget } from '../firetruck';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { BulldozerManager } from '../bulldozer';
import { TractorManager } from '../tractor';
import { ExcavatorManager } from '../excavator';
import { Balloon } from '../balloon';
import {
  FIRETRUCK_LIFETIME,
  FIRETRUCK_COOLDOWN,
  FIRETRUCK_SLOW_FACTOR,
  FIRETRUCK_MAX_SWIVEL,
} from '../constants';

// Lightweight stand-in for a balloon the truck can hose. Counts the slow calls (the
// manager's only responsibility toward a balloon) and mirrors the real
// Balloon.applyWaterSlow clamp so the recorded factor reads true.
class FakeTarget implements SprayTarget {
  loaded = false;
  waterSlow = 1;
  sprayCalls = 0;
  constructor(public x: number, public y: number) {}
  applyWaterSlow(): void {
    this.sprayCalls++;
    this.waterSlow = Math.min(this.waterSlow, FIRETRUCK_SLOW_FACTOR);
  }
}

function make(w = 800, h = 600): FiretruckManager {
  const t = new FiretruckManager();
  t.setScreenSize(w, h);
  return t;
}

const UP = -Math.PI / 2;

describe('FiretruckManager', () => {
  describe('spawn button + state machine', () => {
    it('starts idle and available', () => {
      const t = make();
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
      expect(t.isActive).toBe(false);
    });

    it('spawns when the button is tapped', () => {
      const t = make();
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(true);
      expect(t.state).toBe('active');
    });

    it('does not spawn from a tap away from the button', () => {
      const t = make();
      expect(t.trySpawn(400, 300)).toBe(false);
      expect(t.state).toBe('idle');
    });

    it('cannot be spawned again while active', () => {
      const t = make();
      t.spawn();
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(false);
    });

    it('disappears after its lifetime and enters cooldown', () => {
      const t = make();
      t.spawn();
      t.update(FIRETRUCK_LIFETIME + 0.1, []);
      expect(t.state).toBe('cooldown');
    });

    it('is unavailable during cooldown then returns to idle', () => {
      const t = make();
      t.spawn();
      t.update(FIRETRUCK_LIFETIME + 0.1, []);
      expect(t.isAvailable).toBe(false);
      expect(t.trySpawn(t.buttonX, t.buttonY)).toBe(false);
      t.update(FIRETRUCK_COOLDOWN + 0.1, []);
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
    });

    it('reports cooldown progress from 0 to 1', () => {
      const t = make();
      t.spawn();
      t.update(FIRETRUCK_LIFETIME + 0.01, []); // -> cooldown
      const start = t.cooldownProgress;
      t.update(FIRETRUCK_COOLDOWN / 2, []);
      const mid = t.cooldownProgress;
      expect(start).toBeLessThan(0.2);
      expect(mid).toBeGreaterThan(0.4);
      expect(mid).toBeLessThan(0.6);
    });

    it('fades in on spawn and out at end of life', () => {
      const t = make();
      t.spawn();
      expect(t.alpha).toBe(0);                       // nothing elapsed yet
      t.update(0.3, []);
      expect(t.alpha).toBeCloseTo(1, 1);             // faded in
      t.update(FIRETRUCK_LIFETIME - 0.3 - 0.6, []);  // 0.6s of life left
      // remaining 0.6 / FADE_DURATION 1.2 = 0.5 — pins the fade rate, not just "<1".
      expect(t.alpha).toBeCloseTo(0.5, 1);
    });
  });

  describe('spawn button placement (6th in the left column)', () => {
    it('stacks below the excavator button, sharing the left edge', () => {
      const t = make();
      const heli = new HelicopterManager();
      heli.setScreenSize(800, 600);
      const excavator = new ExcavatorManager();
      excavator.setScreenSize(800, 600);
      expect(t.buttonX).toBe(excavator.buttonX);
      expect(t.buttonX).toBe(heli.buttonX);
      expect(t.buttonY).toBeGreaterThan(excavator.buttonY);
    });

    it('keeps all six button touch targets from overlapping on any screen', () => {
      for (const [w, h] of [[375, 667], [800, 600], [1400, 1024], [320, 480], [480, 300]]) {
        const buttons = makeAllButtons(w, h);
        for (let i = 0; i < buttons.length; i++) {
          for (let j = i + 1; j < buttons.length; j++) {
            const a = buttons[i];
            const b = buttons[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            expect(dist).toBeGreaterThanOrEqual((a.r + b.r) * 1.25);
          }
        }
      }
    });

    it('keeps all six buttons fully on-screen, including short/landscape viewports', () => {
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
      const t = make();
      t.spawn();
      const y0 = t.y;
      for (let i = 0; i < 120; i++) t.update(1 / 60, []);
      expect(t.y).toBe(y0);
      expect(t.y).toBeGreaterThan(600 * 0.6);
      expect(t.y).toBeLessThan(600);
    });

    it('trundles toward a balloon off to the side to get under it', () => {
      const t = make();
      t.spawn();
      const x0 = t.x;                          // spawns near centre
      const b = new FakeTarget(720, t.nozzleY - 150); // off to the right, in the jet's reach
      for (let i = 0; i < 60; i++) t.update(1 / 60, [b]);
      expect(t.x).toBeGreaterThan(x0 + 20);    // drove right toward it
      const half = t.size * 0.5;
      expect(t.x + half).toBeLessThanOrEqual(800 + 1); // stays on-screen
    });
  });

  describe('aiming the water monitor', () => {
    it('swivels toward a balloon off to the right, then to the left', () => {
      const t = make();
      t.spawn();
      const right = new FakeTarget(t.nozzleX + 220, t.nozzleY - 120);
      for (let i = 0; i < 12; i++) t.update(1 / 60, [right]);
      expect(t.aimAngle).toBeGreaterThan(UP + 0.05); // tilted toward the right-side target

      const t2 = make();
      t2.spawn();
      const left = new FakeTarget(t2.nozzleX - 220, t2.nozzleY - 120);
      for (let i = 0; i < 12; i++) t2.update(1 / 60, [left]);
      expect(t2.aimAngle).toBeLessThan(UP - 0.05); // tilted toward the left-side target
    });

    it('never aims below the upper hemisphere, even chasing a low side balloon', () => {
      const t = make();
      t.spawn();
      // A balloon barely above the nozzle and far to the side: its raw aim is nearly
      // horizontal, so the clamp must keep the monitor within ±MAX_SWIVEL of straight up.
      const low = new FakeTarget(t.nozzleX + 380, t.nozzleY - 8);
      for (let i = 0; i < 200; i++) {
        t.update(1 / 60, [low]);
        expect(t.aimAngle).toBeLessThanOrEqual(UP + FIRETRUCK_MAX_SWIVEL + 1e-6);
        expect(t.aimAngle).toBeGreaterThanOrEqual(UP - FIRETRUCK_MAX_SWIVEL - 1e-6);
      }
    });

    it('returns the monitor to straight up when the sky is empty', () => {
      const t = make();
      t.spawn();
      (t as unknown as { aimAngle: number }).aimAngle = 0.4; // knocked off-vertical
      for (let i = 0; i < 120; i++) t.update(1 / 60, []);
      expect(t.aimAngle).toBeCloseTo(UP, 2);
    });
  });

  describe('hosing balloons', () => {
    it('wets a balloon sitting in the jet above the truck', () => {
      const t = make();
      t.spawn();
      const b = new FakeTarget(t.nozzleX, t.nozzleY - 160); // straight up, within reach
      for (let i = 0; i < 10; i++) t.update(1 / 60, [b]);
      expect(b.sprayCalls).toBeGreaterThan(0);
      expect(b.waterSlow).toBe(FIRETRUCK_SLOW_FACTOR);
    });

    it('ignores a balloon outside the spray cone', () => {
      const t = make();
      t.spawn();
      // Nearest balloon overhead is the target (truck aims up at it); a second balloon
      // far to the side sits within reach but well outside the narrow cone.
      const overhead = new FakeTarget(t.nozzleX, t.nozzleY - 80);
      const aside = new FakeTarget(t.nozzleX + 300, t.nozzleY - 30);
      for (let i = 0; i < 30; i++) t.update(1 / 60, [overhead, aside]);
      expect(overhead.waterSlow).toBe(FIRETRUCK_SLOW_FACTOR);
      expect(aside.waterSlow).toBe(1);
    });

    it('ignores a balloon below the nozzle (the jet sprays upward)', () => {
      const t = make();
      t.spawn();
      const below = new FakeTarget(t.nozzleX, t.nozzleY + 60);
      for (let i = 0; i < 30; i++) t.update(1 / 60, [below]);
      expect(below.sprayCalls).toBe(0);
      expect(below.waterSlow).toBe(1);
    });

    it('ignores a balloon risen out of the jet’s reach', () => {
      const t = make();
      t.spawn();
      const high = new FakeTarget(t.nozzleX, t.nozzleY - t.sprayRange - 60);
      for (let i = 0; i < 30; i++) t.update(1 / 60, [high]);
      expect(high.sprayCalls).toBe(0);
      expect(high.waterSlow).toBe(1);
      expect(t.aimAngle).toBeCloseTo(UP, 2); // not even targeted, so the monitor rests up
    });

    it('ignores balloons the tractor / excavator have loaded', () => {
      const t = make();
      t.spawn();
      const loaded = new FakeTarget(t.nozzleX, t.nozzleY - 120);
      loaded.loaded = true;
      for (let i = 0; i < 30; i++) t.update(1 / 60, [loaded]);
      expect(loaded.sprayCalls).toBe(0);
      expect(loaded.waterSlow).toBe(1);
    });

    it('does not spray while idle or in cooldown', () => {
      const t = make();
      // Idle: a balloon straight up in the jet's path, stepped many frames so the aim
      // could settle onto it — only the active-state guard (not geometry/timing) keeps
      // sprayCalls at 0, so deleting the guard would actually fail this.
      const idleTarget = new FakeTarget(t.nozzleX, t.nozzleY - 120);
      for (let i = 0; i < 30; i++) t.update(1 / 60, [idleTarget]);
      expect(idleTarget.sprayCalls).toBe(0);
      expect(idleTarget.waterSlow).toBe(1);
      // Drive to cooldown (no targets on the transition frame), then confirm a balloon
      // where the now-gone truck stood is untouched.
      t.spawn();
      t.update(FIRETRUCK_LIFETIME + 0.1, []);
      expect(t.state).toBe('cooldown');
      const cdTarget = new FakeTarget(t.nozzleX, t.nozzleY - 120);
      t.update(1 / 60, [cdTarget]);
      expect(cdTarget.sprayCalls).toBe(0);
      expect(cdTarget.waterSlow).toBe(1);
    });

    it('slows a real balloon kept under the jet well below a free one', () => {
      // A hosed balloon overhead vs an identical free balloon: both forced to the same
      // rise speed; the truck tracks and wets the first every frame (slow applied after
      // it moves, matching the game's update order), so it should rise markedly less.
      const t = make();
      t.spawn();
      const startY = t.nozzleY - 40;
      const hosed = new Balloon(800, 600);
      const free = new Balloon(800, 600);
      (hosed as unknown as { speed: number }).speed = 80;
      (free as unknown as { speed: number }).speed = 80;
      hosed.x = hosed.baseX = t.nozzleX;
      hosed.y = startY;
      free.x = free.baseX = 60; // far from the truck, never sprayed
      free.y = startY;
      for (let i = 0; i < 180; i++) {
        hosed.update(1 / 60);    // balloons move & recover first…
        free.update(1 / 60);
        t.update(1 / 60, [hosed]); // …then the truck re-applies the slow to the hosed one
      }
      const hosedRise = startY - hosed.y;
      const freeRise = startY - free.y;
      expect(hosedRise).toBeGreaterThan(0);
      expect(freeRise).toBeGreaterThan(0);
      expect(hosedRise).toBeLessThan(freeRise * 0.6); // meaningfully throttled
    });

    it('lets a hosed balloon dry out and speed back up once the jet moves off it', () => {
      // The truck claims nothing, so a wet balloon must recover on its own (like rain).
      const t = make();
      t.spawn();
      const b = new Balloon(800, 600);
      b.x = b.baseX = t.nozzleX;
      b.y = t.nozzleY - 160;
      for (let i = 0; i < 30; i++) { b.update(1 / 60); t.update(1 / 60, [b]); } // wet it
      expect(b.rainSlow).toBeLessThan(1);
      // Jet off it (dropped from the spray list): it dries and returns to full speed.
      for (let i = 0; i < 120; i++) { b.update(1 / 60); t.update(1 / 60, []); }
      expect(b.rainSlow).toBe(1);
    });
  });

  describe('lifecycle', () => {
    it('clear() removes the truck and skips the cooldown', () => {
      const t = make();
      t.spawn();
      t.update(1, []);
      t.clear();
      expect(t.state).toBe('idle');
      expect(t.isAvailable).toBe(true);
      expect(t.alpha).toBe(0);
    });

    it('reset() returns to a fresh idle state with the monitor stowed upright', () => {
      const t = make();
      t.spawn();
      (t as unknown as { aimAngle: number }).aimAngle = 0.5;
      t.update(1, []);
      t.reset();
      expect(t.state).toBe('idle');
      expect(t.alpha).toBe(0);
      expect(t.aimAngle).toBeCloseTo(UP, 6);
    });

    it('keeps the truck on-screen across a shrinking resize', () => {
      const t = make(800, 600);
      t.spawn();
      const b = new FakeTarget(780, 300);
      for (let i = 0; i < 90; i++) t.update(1 / 60, [b]); // drive toward the right wall
      t.setScreenSize(400, 300);
      expect(t.x + t.size * 0.5).toBeLessThanOrEqual(400 + 1);
      for (let i = 0; i < 60; i++) t.update(1 / 60, [b]);
      expect(t.x + t.size * 0.5).toBeLessThanOrEqual(400 + 1);
    });
  });
});

// Build the six vehicle spawn buttons at a given viewport for placement checks.
function makeAllButtons(w: number, h: number): Array<{ x: number; y: number; r: number }> {
  const heli = new HelicopterManager();
  heli.setScreenSize(w, h);
  const plane = new PlaneManager();
  plane.setScreenSize(w, h);
  const dozer = new BulldozerManager();
  dozer.setScreenSize(w, h);
  const tractor = new TractorManager();
  tractor.setScreenSize(w, h);
  const excavator = new ExcavatorManager();
  excavator.setScreenSize(w, h);
  const firetruck = new FiretruckManager();
  firetruck.setScreenSize(w, h);
  return [
    { x: heli.buttonX, y: heli.buttonY, r: heli.buttonRadius },
    { x: plane.buttonX, y: plane.buttonY, r: plane.buttonRadius },
    { x: dozer.buttonX, y: dozer.buttonY, r: dozer.buttonRadius },
    { x: tractor.buttonX, y: tractor.buttonY, r: tractor.buttonRadius },
    { x: excavator.buttonX, y: excavator.buttonY, r: excavator.buttonRadius },
    { x: firetruck.buttonX, y: firetruck.buttonY, r: firetruck.buttonRadius },
  ];
}
