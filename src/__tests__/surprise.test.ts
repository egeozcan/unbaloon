import { describe, it, expect } from 'vitest';
import { SurpriseManager } from '../surprise';

describe('SurpriseManager', () => {
  describe('tap counter', () => {
    it('does not fire event immediately', () => {
      const sm = new SurpriseManager();
      expect(sm.getActiveEvent()).toBeNull();
    });

    it('fires event after reaching threshold', () => {
      const sm = new SurpriseManager();
      let eventFired = false;
      for (let i = 0; i < 8; i++) {
        sm.incrementCounter(1);
        if (sm.hasPendingEvent()) { eventFired = true; break; }
      }
      expect(eventFired).toBe(true);
    });

    it('fires by 5 taps at minimum threshold', () => {
      const sm = new SurpriseManager();
      (sm as any).threshold = 5;
      (sm as any).counter = 0;
      for (let i = 0; i < 5; i++) { sm.incrementCounter(1); }
      expect(sm.hasPendingEvent()).toBe(true);
    });

    it('counts special balloon pops as 2', () => {
      const sm = new SurpriseManager();
      (sm as any).threshold = 5;
      (sm as any).counter = 0;
      sm.incrementCounter(2);
      sm.incrementCounter(2);
      sm.incrementCounter(1);
      expect(sm.hasPendingEvent()).toBe(true);
    });
  });

  describe('event selection', () => {
    it('never repeats back-to-back', () => {
      const sm = new SurpriseManager();
      const events: string[] = [];
      for (let i = 0; i < 20; i++) {
        (sm as any).counter = 0;
        (sm as any).threshold = 1;
        sm.incrementCounter(1);
        const pending = sm.consumePendingEvent(0, 0);
        if (pending) events.push(pending);
      }
      for (let i = 1; i < events.length; i++) {
        expect(events[i]).not.toBe(events[i - 1]);
      }
    });
  });

  describe('reset', () => {
    it('clears counter and active event', () => {
      const sm = new SurpriseManager();
      (sm as any).counter = 7;
      sm.reset();
      expect((sm as any).counter).toBe(0);
      expect(sm.getActiveEvent()).toBeNull();
    });
  });
});
