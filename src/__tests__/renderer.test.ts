import { describe, it, expect } from 'vitest';
import { Renderer } from '../renderer';
import { BulldozerManager } from '../bulldozer';

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
