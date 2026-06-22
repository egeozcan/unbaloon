import { describe, it, expect } from 'vitest';
import { Balloon } from '../balloon';

describe('Balloon', () => {
  describe('tap', () => {
    it('decrements a multi-number balloon, then pops at 1', () => {
      const b = new Balloon(800, 600);
      b.number = 2;
      expect(b.tap()).toBe('decremented');
      expect(b.number).toBe(1);
      // still squeezing (tappable) → next tap pops
      expect(b.tap()).toBe('popped');
      expect(b.state).toBe('popping');
    });

    it('ignores a tap on an already-popping balloon (no re-pop)', () => {
      const b = new Balloon(800, 600);
      b.number = 1;
      expect(b.tap()).toBe('popped');
      expect(b.tap()).toBe('ignored');
    });
  });
});
