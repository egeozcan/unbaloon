import { describe, it, expect } from 'vitest';
import { Renderer } from '../renderer';
import { BulldozerManager } from '../bulldozer';
import { ExcavatorManager } from '../excavator';
import { FiretruckManager } from '../firetruck';
import { WheelLoaderManager } from '../wheelloader';
import { JeepManager } from '../jeep';
import { BackhoeManager } from '../backhoe';
import { WheeledExcavatorManager } from '../wheeledexcavator';
import { PurplePlaneManager } from '../purpleplane';

// A minimal stand-in for CanvasRenderingContext2D that records save/restore
// balance and swallows every drawing call. Enough to smoke-test that the canvas
// drawing code runs without throwing and never leaks a save() (which would
// corrupt the transform/clip stack for everything drawn afterwards).
function makeMockCtx() {
  let depth = 0;
  let maxDepth = 0;
  let minDepth = 0;
  const grad = { addColorStop() {} };
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'save') return () => { depth++; maxDepth = Math.max(maxDepth, depth); };
      if (prop === 'restore') return () => { depth--; minDepth = Math.min(minDepth, depth); };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === '__depth') return () => depth;
      if (prop === '__maxDepth') return () => maxDepth;
      if (prop === '__minDepth') return () => minDepth;
      // Any other method is a no-op; any property read returns undefined.
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) {
        // Heuristic: methods are called, style props are assigned. Return a
        // callable that also tolerates being read as a value.
        return () => undefined;
      }
      return undefined;
    },
    set() { return true; },
  };
  const ctx = new Proxy({}, handler);
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    depth: () => depth,
    maxDepth: () => maxDepth,
    minDepth: () => minDepth,
  };
}

describe('Renderer bulldozer drawing', () => {
  function drawAt(heading: number) {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const dozer = new BulldozerManager();
    dozer.setScreenSize(800, 600);
    dozer.spawn();
    dozer.heading = heading;
    (dozer as any).lifeTimer = 1; // alpha > 0 so it actually draws
    dozer.crushing = true; // exercise the blade-jitter branch too
    renderer.drawBulldozer(dozer);
    return mock;
  }

  it('draws without throwing and balances save/restore for every heading', () => {
    // 0 = right, π = left (mirror branch), ±π/2 = vertical, plus a diagonal.
    for (const h of [0, Math.PI, Math.PI / 2, -Math.PI / 2, 0.7, -2.4]) {
      const mock = drawAt(h);
      expect(mock.depth()).toBe(0);   // every save() was matched by a restore()
      expect(mock.minDepth()).toBe(0); // never restored below the starting level
    }
  });

  it('skips drawing entirely while invisible (alpha 0)', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const dozer = new BulldozerManager();
    dozer.setScreenSize(800, 600);
    // idle -> alpha 0; drawBulldozer should early-out and touch nothing.
    renderer.drawBulldozer(dozer);
    expect(mock.maxDepth()).toBe(0);
  });

  it('draws the spawn button (available and during cooldown) without leaking saves', () => {
    for (const cooling of [false, true]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const dozer = new BulldozerManager();
      dozer.setScreenSize(800, 600);
      if (cooling) {
        dozer.spawn();
        dozer.update(1000, [], () => {}); // -> cooldown
      }
      renderer.drawBulldozerButton(dozer);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });
});

describe('Renderer excavator drawing', () => {
  function settled(): ExcavatorManager {
    const ex = new ExcavatorManager();
    ex.setScreenSize(800, 600);
    ex.spawn();
    for (let i = 0; i < 40; i++) ex.update(1 / 60, [], () => {});
    return ex;
  }

  it('draws without throwing and balances save/restore', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    renderer.drawExcavator(settled());
    expect(mock.depth()).toBe(0);
    expect(mock.minDepth()).toBe(0);
  });

  it('exercises the chomp branch without leaking saves', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const ex = settled();
    ex.gripping = true;
    ex.chompPulse = 1;
    ex.bucketAngle = 1.2; // a tilted wrist
    renderer.drawExcavator(ex);
    expect(mock.depth()).toBe(0);
    expect(mock.minDepth()).toBe(0);
  });

  it('skips drawing entirely while invisible (alpha 0)', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const ex = new ExcavatorManager();
    ex.setScreenSize(800, 600); // idle → alpha 0
    renderer.drawExcavator(ex);
    expect(mock.maxDepth()).toBe(0);
  });

  it('draws the spawn button (available and during cooldown) without leaking saves', () => {
    for (const cooling of [false, true]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const ex = new ExcavatorManager();
      ex.setScreenSize(800, 600);
      if (cooling) {
        ex.spawn();
        ex.update(1000, [], () => {}); // -> cooldown
      }
      renderer.drawExcavatorButton(ex);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });
});

describe('Renderer fire truck drawing', () => {
  function settled(): FiretruckManager {
    const t = new FiretruckManager();
    t.setScreenSize(800, 600);
    t.spawn();
    for (let i = 0; i < 40; i++) t.update(1 / 60, []);
    return t;
  }

  it('draws without throwing and balances save/restore (jet on)', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    renderer.drawFiretruck(settled());
    expect(mock.depth()).toBe(0);
    expect(mock.minDepth()).toBe(0);
  });

  it('balances save/restore across a range of monitor aims', () => {
    for (const aim of [-Math.PI / 2, -0.5, -2.4, -Math.PI / 2 + 1.1, -Math.PI / 2 - 1.1]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const t = settled();
      (t as unknown as { aimAngle: number }).aimAngle = aim;
      renderer.drawFiretruck(t);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });

  it('skips drawing entirely while invisible (alpha 0)', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const t = new FiretruckManager();
    t.setScreenSize(800, 600); // idle → alpha 0
    renderer.drawFiretruck(t);
    expect(mock.maxDepth()).toBe(0);
  });

  it('draws the spawn button (available and during cooldown) without leaking saves', () => {
    for (const cooling of [false, true]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const t = new FiretruckManager();
      t.setScreenSize(800, 600);
      if (cooling) {
        t.spawn();
        t.update(1000, []); // -> cooldown
      }
      renderer.drawFiretruckButton(t);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });
});

describe('Renderer wheel loader drawing', () => {
  function out(): WheelLoaderManager {
    const l = new WheelLoaderManager();
    l.setScreenSize(800, 600);
    l.spawn();
    (l as unknown as { lifeTimer: number }).lifeTimer = 1; // alpha > 0 so it draws
    l.wheelPhase = 0.7;
    return l;
  }

  it('draws without throwing and balances save/restore, facing either way', () => {
    for (const facing of [1, -1]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const l = out();
      l.facing = facing;
      renderer.drawWheelLoader(l);
      expect(mock.depth()).toBe(0);   // every save() matched by a restore()
      expect(mock.minDepth()).toBe(0); // never restored below the starting level
    }
  });

  it('skips drawing entirely while invisible (alpha 0)', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const l = new WheelLoaderManager();
    l.setScreenSize(800, 600); // idle → alpha 0
    renderer.drawWheelLoader(l);
    expect(mock.maxDepth()).toBe(0);
  });

  it('draws the spawn button (available and during cooldown) without leaking saves', () => {
    for (const cooling of [false, true]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const l = new WheelLoaderManager();
      l.setScreenSize(800, 600);
      if (cooling) {
        l.spawn();
        l.update(1000, [], []); // -> cooldown
      }
      renderer.drawWheelLoaderButton(l);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });
});

describe('Renderer new vehicle drawing', () => {
  it('draws all four active vehicles without leaking canvas state', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const jeep = new JeepManager();
    const backhoe = new BackhoeManager();
    const excavator = new WheeledExcavatorManager();
    const plane = new PurplePlaneManager();
    for (const manager of [jeep, backhoe, excavator, plane]) {
      manager.setScreenSize(800, 600);
      manager.spawn();
      (manager as any).lifeTimer = 1;
    }
    jeep.bonkPulse = 1;
    backhoe.update(1 / 60, 300, 300, []);
    excavator.update(1 / 60, [], () => {});
    plane.update(0.1, 400, 300, [], () => {});

    renderer.drawJeep(jeep);
    renderer.drawBackhoe(backhoe);
    renderer.drawWheeledExcavator(excavator);
    renderer.drawPurplePlaneTrail(plane);
    renderer.drawPurplePlane(plane);
    expect(mock.depth()).toBe(0);
    expect(mock.minDepth()).toBe(0);
  });

  it('skips all four body drawings while they are invisible', () => {
    const mock = makeMockCtx();
    const renderer = new Renderer(mock.ctx);
    const jeep = new JeepManager();
    const backhoe = new BackhoeManager();
    const excavator = new WheeledExcavatorManager();
    const plane = new PurplePlaneManager();
    for (const manager of [jeep, backhoe, excavator, plane]) manager.setScreenSize(800, 600);
    renderer.drawJeep(jeep);
    renderer.drawBackhoe(backhoe);
    renderer.drawWheeledExcavator(excavator);
    renderer.drawPurplePlaneTrail(plane);
    renderer.drawPurplePlane(plane);
    expect(mock.maxDepth()).toBe(0);
  });

  it('draws every new button available and cooling down without leaking saves', () => {
    for (const cooling of [false, true]) {
      const mock = makeMockCtx();
      const renderer = new Renderer(mock.ctx);
      const jeep = new JeepManager();
      const backhoe = new BackhoeManager();
      const excavator = new WheeledExcavatorManager();
      const plane = new PurplePlaneManager();
      for (const manager of [jeep, backhoe, excavator, plane]) {
        manager.setScreenSize(800, 600);
        if (cooling) Object.assign(manager, { state: 'cooldown' });
      }
      renderer.drawJeepButton(jeep);
      renderer.drawBackhoeButton(backhoe);
      renderer.drawWheeledExcavatorButton(excavator);
      renderer.drawPurplePlaneButton(plane);
      expect(mock.depth()).toBe(0);
      expect(mock.minDepth()).toBe(0);
    }
  });
});
