import { describe, it, expect } from 'vitest';
import { SessionManager } from '../session';

describe('SessionManager', () => {
  describe('getPhase', () => {
    it('returns 1 at elapsed=0', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(0)).toBe(1);
    });

    it('returns 1 just before phase 1 ends', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(119)).toBe(1);
    });

    it('returns 2 at phase 1 boundary', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(120)).toBe(2);
    });

    it('returns 2 during cruising', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(200)).toBe(2);
    });

    it('returns 3 at phase 2 boundary', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(300)).toBe(3);
    });

    it('returns 4 at phase 3 boundary', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(390)).toBe(4);
    });

    it('returns 4 well past finale start', () => {
      const sm = new SessionManager();
      expect(sm.getPhase(500)).toBe(4);
    });
  });

  describe('getSpawnInterval', () => {
    it('starts at 2.0s', () => {
      const sm = new SessionManager();
      expect(sm.getSpawnInterval(0)).toBeCloseTo(2.0);
    });

    it('reaches 1.0s at end of phase 1', () => {
      const sm = new SessionManager();
      expect(sm.getSpawnInterval(120)).toBeCloseTo(1.0);
    });

    it('holds at 1.0s during phase 2', () => {
      const sm = new SessionManager();
      expect(sm.getSpawnInterval(200)).toBeCloseTo(1.0);
    });

    it('increases during phase 3', () => {
      const sm = new SessionManager();
      const interval = sm.getSpawnInterval(345);
      expect(interval).toBeGreaterThan(1.0);
      expect(interval).toBeLessThanOrEqual(2.5);
    });

    it('returns Infinity during phase 4 (no spawning)', () => {
      const sm = new SessionManager();
      expect(sm.getSpawnInterval(390)).toBe(Infinity);
    });
  });

  describe('getSpeedMultiplier', () => {
    it('returns 1.0 during phase 1', () => {
      const sm = new SessionManager();
      expect(sm.getSpeedMultiplier(50)).toBe(1.0);
    });

    it('returns 1.0 during phase 2', () => {
      const sm = new SessionManager();
      expect(sm.getSpeedMultiplier(200)).toBe(1.0);
    });

    it('returns 0.7 during phase 3', () => {
      const sm = new SessionManager();
      expect(sm.getSpeedMultiplier(300)).toBe(0.7);
    });

    it('returns 0.7 during phase 4', () => {
      const sm = new SessionManager();
      expect(sm.getSpeedMultiplier(400)).toBe(0.7);
    });
  });

  describe('getSizeMultiplier', () => {
    it('returns 1.0 during phase 1', () => {
      const sm = new SessionManager();
      expect(sm.getSizeMultiplier(50)).toBe(1.0);
    });

    it('returns 1.0 during phase 2', () => {
      const sm = new SessionManager();
      expect(sm.getSizeMultiplier(200)).toBe(1.0);
    });

    it('returns 1.2 during phase 3', () => {
      const sm = new SessionManager();
      expect(sm.getSizeMultiplier(300)).toBe(1.2);
    });
  });
});
