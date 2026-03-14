# Surprise Toybox Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the score gauge / level system with a sensory "surprise toybox" — random delight events, special balloons, richer sounds, and a bounded ~7-minute session arc with a gentle finale.

**Architecture:** The game is a canvas-based TypeScript app using Vite. Two new modules are added: `SessionManager` (pure query object for phase/timing) and `SurpriseManager` (event pool, counter, bubble state). Existing modules (`balloon.ts`, `renderer.ts`, `audio.ts`, `game.ts`) are modified. No external assets — all sounds synthesized via Web Audio API.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Web Audio API, Vitest (added for testable modules)

**Spec:** `docs/superpowers/specs/2026-03-14-surprise-toybox-design.md`

---

## File Map

### New Files
- `src/session.ts` — Session arc state machine. Pure query object: `getPhase()`, `getSpawnInterval()`, `getSpeedMultiplier()`, `getSizeMultiplier()`. No side effects.
- `src/surprise.ts` — Surprise event system: tap counter, event pool, active event state/animation, bubble state, hit testing.
- `src/__tests__/session.test.ts` — Tests for session manager
- `src/__tests__/surprise.test.ts` — Tests for surprise counter/event selection logic

### Modified Files
- `src/constants.ts` — Remove `GAUGE_*` constants, add session/surprise/special/sound constants, change `SPAWN_RAMP_DURATION` to 120
- `src/balloon.ts` — Add `specialType`, `isFinale`, `sizeMultiplier` fields. Adjust constructor signature.
- `src/audio.ts` — Rework `playTap()`/`playPop()`, add ~14 new sound methods
- `src/renderer.ts` — Remove `drawGauge()`. Add surprise event rendering (rainbow, confetti, stars, bubbles), special balloon rendering (star shimmer, animal faces, rainbow gradient), finale balloon rendering.
- `src/game.ts` — Remove gauge state. Add `SessionManager`, `SurpriseManager`. Wire tap counter, phase transitions, special balloon spawning, finale sequence, `reset()` method.
- `src/index.ts` — Hide start screen (not remove). Add play-again overlay wiring.
- `index.html` — Add play-again overlay markup.
- `package.json` — Add vitest dev dependency

---

## Chunk 1: Foundation — Strip Gauge, Constants, Session Manager

### Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure vitest in vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/unbaloon/',
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: "No test files found" or similar (clean exit)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: Strip Gauge System

**Files:**
- Modify: `src/constants.ts` (remove lines 63-69: all `GAUGE_*` constants)
- Modify: `src/game.ts` (remove gauge state, `incrementGauge()`, gauge drawing call, `speedMultiplier`)
- Modify: `src/renderer.ts` (remove `drawGauge()` method and its imports)

- [ ] **Step 1: Remove GAUGE constants from constants.ts**

Remove these lines from `src/constants.ts`:
```ts
// Score gauge
export const GAUGE_MAX = 20;
export const GAUGE_RADIUS_RATIO = 0.09;  // relative to screen width
export const GAUGE_MARGIN = 16;           // CSS px from edges
export const GAUGE_LINE_WIDTH_RATIO = 0.22; // relative to gauge radius
export const GAUGE_SPEED_MULTIPLIER = 1.2;  // speed increase per level reset
export const GAUGE_COLORS = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF'];
export const GAUGE_FLASH_DURATION = 0.4; // seconds
```

- [ ] **Step 2: Remove gauge state and logic from game.ts**

In `src/game.ts`:

Remove these imports from the constants import:
```ts
GAUGE_MAX,
GAUGE_SPEED_MULTIPLIER,
GAUGE_FLASH_DURATION,
```

Remove these fields:
```ts
// Score & gauge
private gaugeCount: number = 0;
private level: number = 0;
private speedMultiplier: number = 1;
private gaugeFlashTimer: number = 0;
```

Remove the `incrementGauge()` method entirely.

Remove the gauge flash countdown block from `update()`:
```ts
// Gauge flash countdown
if (this.gaugeFlashTimer > 0) {
  this.gaugeFlashTimer = Math.max(0, this.gaugeFlashTimer - dt);
}
```

Remove the gauge drawing call from `draw()`:
```ts
this.renderer.drawGauge(this.width, this.gaugeCount, this.level, this.gaugeFlashTimer);
```

In `tapBalloon()`, remove the `this.incrementGauge()` call.

In `getSpawnInterval()`, change `return base / this.speedMultiplier;` to `return base;`.

In `spawnBalloon()`, change `new Balloon(this.width, this.height, this.speedMultiplier)` to `new Balloon(this.width, this.height)`.

- [ ] **Step 3: Remove drawGauge from renderer.ts**

In `src/renderer.ts`:

Remove these imports from the constants import:
```ts
GAUGE_MAX,
GAUGE_RADIUS_RATIO,
GAUGE_MARGIN,
GAUGE_LINE_WIDTH_RATIO,
GAUGE_COLORS,
GAUGE_FLASH_DURATION,
```

Remove the entire `drawGauge()` method (lines 134-232).

- [ ] **Step 4: Remove speedMultiplier from Balloon constructor**

In `src/balloon.ts`, change the constructor signature from:
```ts
constructor(screenWidth: number, screenHeight: number, speedMultiplier: number = 1)
```
to:
```ts
constructor(screenWidth: number, screenHeight: number)
```

And change the speed line from:
```ts
this.speed = (FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN)) * speedMultiplier;
```
to:
```ts
this.speed = FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN);
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify game loads in browser**

Run: `npm run dev`
Open in browser. Verify: balloons float up, tapping works, no gauge visible, no console errors.

- [ ] **Step 7: Commit**

```bash
git add src/constants.ts src/game.ts src/renderer.ts src/balloon.ts
git commit -m "feat: strip gauge/level system to prepare for surprise toybox"
```

---

### Task 3: Add Session Constants

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Update SPAWN_RAMP_DURATION and add session constants**

In `src/constants.ts`, change:
```ts
export const SPAWN_RAMP_DURATION = 180;  // seconds (3 minutes)
```
to:
```ts
export const SPAWN_RAMP_DURATION = 120;  // seconds — ramp completes at end of Phase 1
```

Add at the end of the file:
```ts
// Session arc phases (in seconds of active play time)
export const PHASE_1_END = 120;   // Ramp Up ends
export const PHASE_2_END = 300;   // Cruising ends
export const PHASE_3_END = 390;   // Wind Down ends, Finale begins
export const FINALE_WAIT_TIMEOUT = 5; // seconds to wait for screen to clear before forcing finale

// Phase 3 multipliers
export const WIND_DOWN_SPEED_MULTIPLIER = 0.7;
export const WIND_DOWN_SIZE_MULTIPLIER = 1.2;
export const WIND_DOWN_SPAWN_INTERVAL = 2.25; // midpoint of 2.0-2.5 range

// Special balloon constants
export const SPECIAL_SPAWN_CHANCE = 0.1;     // 10% chance per spawn
export const SPECIAL_SPEED_MULTIPLIER = 0.7; // 30% slower than regular
export const SPECIAL_RAINBOW_SIZE_MULTIPLIER = 1.2; // 20% bigger
export const FINALE_BALLOON_SIZE_MULTIPLIER = 2.0;
export const FINALE_BALLOON_SPEED = 30; // CSS px/s — very slow
export const FINALE_TAP_DELAY = 0.5; // seconds before finale balloon is tappable

// Surprise event constants
export const SURPRISE_COUNTER_MIN = 5;
export const SURPRISE_COUNTER_MAX = 8;
export const SPECIAL_SURPRISE_INCREMENT = 2; // special balloons count as 2 taps

// Surprise event durations
export const RAINBOW_DURATION = 1.5;
export const CONFETTI_DURATION = 2.0;
export const STARBURST_DURATION = 1.5;
export const BUBBLE_DURATION = 3.0;
export const BUBBLE_COUNT_MIN = 8;
export const BUBBLE_COUNT_MAX = 12;
export const BUBBLE_RADIUS = 20; // CSS px

// Confetti particle constants
export const CONFETTI_COUNT = 40;
export const CONFETTI_WIDTH = 8;
export const CONFETTI_HEIGHT = 12;

// Star burst particle constants
export const STARBURST_COUNT_MIN = 10;
export const STARBURST_COUNT_MAX = 15;
export const STARBURST_STAR_SIZE = 8;

// Phase 3 event weights
export const WIND_DOWN_GENTLE_WEIGHT = 0.7; // stars + bubbles
export const WIND_DOWN_OTHER_WEIGHT = 0.3;  // rainbow + confetti + silly

// Rainbow colors for special/finale balloon gradient
export const RAINBOW_GRADIENT_COLORS = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF'];

// Special balloon colors
export const SPECIAL_STAR_COLOR = '#FFD700';
export const SPECIAL_CAT_COLOR = '#FF9999';
export const SPECIAL_FROG_COLOR = '#44BB44';
export const SPECIAL_BIRD_COLOR = '#88BBFF';

// Finale celebration
export const FINALE_CELEBRATION_DURATION = 3.0; // seconds
export const FINALE_FADE_DURATION = 1.0; // seconds for screen fade after celebration
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add session arc and surprise toybox constants"
```

---

### Task 4: Create Session Manager (TDD)

**Files:**
- Create: `src/session.ts`
- Create: `src/__tests__/session.test.ts`

- [ ] **Step 1: Write session manager tests**

Create `src/__tests__/session.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../session`

- [ ] **Step 3: Implement SessionManager**

Create `src/session.ts`:
```ts
import {
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_END,
  SPAWN_RAMP_DURATION,
  PHASE_1_END,
  PHASE_2_END,
  PHASE_3_END,
  WIND_DOWN_SPEED_MULTIPLIER,
  WIND_DOWN_SIZE_MULTIPLIER,
  WIND_DOWN_SPAWN_INTERVAL,
} from './constants';

export type Phase = 1 | 2 | 3 | 4;

export class SessionManager {
  getPhase(elapsed: number): Phase {
    if (elapsed < PHASE_1_END) return 1;
    if (elapsed < PHASE_2_END) return 2;
    if (elapsed < PHASE_3_END) return 3;
    return 4;
  }

  getSpawnInterval(elapsed: number): number {
    const phase = this.getPhase(elapsed);

    switch (phase) {
      case 1: {
        // Linear ramp from SPAWN_INTERVAL_START to SPAWN_INTERVAL_END
        const t = Math.min(elapsed / SPAWN_RAMP_DURATION, 1);
        return SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * t;
      }
      case 2:
        return SPAWN_INTERVAL_END;
      case 3: {
        // Linear ramp from SPAWN_INTERVAL_END back up to WIND_DOWN_SPAWN_INTERVAL
        const phaseProgress = (elapsed - PHASE_2_END) / (PHASE_3_END - PHASE_2_END);
        return SPAWN_INTERVAL_END + (WIND_DOWN_SPAWN_INTERVAL - SPAWN_INTERVAL_END) * phaseProgress;
      }
      case 4:
        return Infinity; // No spawning
    }
  }

  getSpeedMultiplier(elapsed: number): number {
    const phase = this.getPhase(elapsed);
    return phase >= 3 ? WIND_DOWN_SPEED_MULTIPLIER : 1.0;
  }

  getSizeMultiplier(elapsed: number): number {
    const phase = this.getPhase(elapsed);
    return phase >= 3 ? WIND_DOWN_SIZE_MULTIPLIER : 1.0;
  }

  reset(): void {
    // SessionManager is stateless (derives everything from elapsed),
    // but reset() is part of the contract for spec compliance.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/session.ts src/__tests__/session.test.ts
git commit -m "feat: add SessionManager with phase-based spawn/speed/size logic"
```

---

## Chunk 2: Audio — Rework Existing Sounds, Add New Sounds

### Task 5: Rework Existing Sounds (playTap, playPop)

**Files:**
- Modify: `src/audio.ts`

- [ ] **Step 1: Replace playTap with warmer "bonk" sound**

In `src/audio.ts`, replace the `playTap()` method:

```ts
playTap(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}
```

- [ ] **Step 2: Replace playPop with realistic air-burst sound**

Replace the `playPop()` method:

```ts
playPop(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  // Layer 1: White noise burst
  const bufferSize = Math.ceil(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.03);

  // Layer 2: Mid-frequency thump
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.02);
  oscGain.gain.setValueAtTime(0.2, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.02);
}
```

- [ ] **Step 3: Verify build passes and test in browser**

Run: `npx tsc --noEmit`
Run: `npm run dev` — tap balloons, listen to new sounds.

- [ ] **Step 4: Commit**

```bash
git add src/audio.ts
git commit -m "feat: rework tap and pop sounds for realistic feel"
```

---

### Task 6: Add Surprise Event Sounds

**Files:**
- Modify: `src/audio.ts`

- [ ] **Step 1: Add rainbow whoosh sound**

Add to `AudioManager` class:
```ts
playRainbowWhoosh(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const bufferSize = Math.ceil(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.Q.value = 2;
  bandpass.frequency.setValueAtTime(200, now);
  bandpass.frequency.exponentialRampToValueAtTime(800, now + 1.0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.6);
  gain.gain.linearRampToValueAtTime(0, now + 1.0);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(-1, now);
  panner.pan.linearRampToValueAtTime(1, now + 1.0);

  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 1.0);
}
```

- [ ] **Step 2: Add confetti patter sound**

```ts
playConfettiPatter(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 20; i++) {
    const time = now + Math.random() * 1.5;
    const bufSize = Math.ceil(ctx.sampleRate * 0.002);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < bufSize; j++) {
      d[j] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.01);

    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    src.start(time);
    src.stop(time + 0.01);
  }
}
```

- [ ] **Step 3: Add star sparkle sound**

```ts
playStarSparkle(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const freqs = [1200, 1600, 2000, 2400];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startTime = now + i * 0.08;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}
```

- [ ] **Step 4: Add bubble bloop sound**

```ts
playBubbleBloop(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/audio.ts
git commit -m "feat: add surprise event sounds (rainbow, confetti, sparkle, bubble)"
```

---

### Task 7: Add Silly Sounds and Animal Sounds

**Files:**
- Modify: `src/audio.ts`

- [ ] **Step 1: Add silly sounds (quack, boing, slide whistle, giggle)**

Add to `AudioManager`:
```ts
playQuack(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.1;
    const osc = ctx.createOscillator();
    const bandpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, t);
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800;
    bandpass.Q.value = 3;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

playBoing(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);

  // Bouncing frequency decay
  const times = [0, 0.08, 0.15, 0.22, 0.3, 0.4];
  const freqs = [600, 200, 450, 180, 350, 150];
  times.forEach((t, i) => {
    osc.frequency.setValueAtTime(freqs[i], now + t);
  });

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

playSlideWhistle(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(1200, now + 0.25);
  osc.frequency.linearRampToValueAtTime(300, now + 0.5);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.setValueAtTime(0.2, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

playGiggle(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  // Three short tremolo bursts
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.15;
    const osc = ctx.createOscillator();
    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    const masterGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(500 + i * 50, t);

    tremolo.type = 'sine';
    tremolo.frequency.value = 8;
    tremoloGain.gain.value = 0.08;

    masterGain.gain.setValueAtTime(0.15, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    tremolo.connect(tremoloGain);
    tremoloGain.connect(masterGain.gain);
    osc.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc.start(t);
    tremolo.start(t);
    osc.stop(t + 0.12);
    tremolo.stop(t + 0.12);
  }
}
```

- [ ] **Step 2: Add animal sounds (meow, ribbit, tweet)**

```ts
playMeow(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

playRibbit(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

playTweet(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  for (let i = 0; i < 6; i++) {
    const t = now + i * 0.015;
    const freq = i % 2 === 0 ? 1800 : 2200;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.015);
  }
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/audio.ts
git commit -m "feat: add silly sounds (quack, boing, whistle, giggle) and animal sounds (meow, ribbit, tweet)"
```

---

### Task 8: Add Special Balloon and Finale Sounds

**Files:**
- Modify: `src/audio.ts`

- [ ] **Step 1: Add star chime, rainbow harp, and finale celebration sounds**

Add to `AudioManager`:
```ts
playStarChime(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  // Main bell tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1000, now);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.6);

  // Slightly detuned shimmer
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1007, now);
  gain2.gain.setValueAtTime(0.1, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.6);
}

playRainbowHarp(): void {
  const ctx = this.ensureContext();
  const now = ctx.currentTime;

  // C5, G5, C6, E6, G6
  const freqs = [523.25, 783.99, 1046.50, 1318.51, 1567.98];
  freqs.forEach((freq, i) => {
    const t = now + i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

playFinaleCelebration(): void {
  this.playStarSparkle();
  this.playRainbowWhoosh();
  this.playConfettiPatter();
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/audio.ts
git commit -m "feat: add star chime, rainbow harp, and finale celebration sounds"
```

---

## Chunk 3: Balloons — Special Types, Size Multiplier, Rendering

### Task 9: Extend Balloon Class for Special Types

**Files:**
- Modify: `src/balloon.ts`

- [ ] **Step 1: Add specialType, isFinale, and sizeMultiplier to Balloon**

In `src/balloon.ts`, add imports:
```ts
import {
  // ... existing imports ...
  SPECIAL_SPEED_MULTIPLIER,
  SPECIAL_RAINBOW_SIZE_MULTIPLIER,
  FINALE_BALLOON_SIZE_MULTIPLIER,
  FINALE_BALLOON_SPEED,
} from './constants';
```

Add the type at the top (after BalloonState):
```ts
export type SpecialType = 'star' | 'animal-cat' | 'animal-frog' | 'animal-bird' | 'rainbow';
```

Add fields to the `Balloon` class (after `dragged`):
```ts
specialType?: SpecialType;
isFinale: boolean = false;
animTime: number = 0; // Time accumulator for visual effects (e.g., star shimmer)
private screenHeight: number = 0; // Stored for finale stop-at-center check
```

Update the constructor signature to accept multipliers:
```ts
constructor(screenWidth: number, screenHeight: number, speedMultiplier: number = 1, sizeMultiplier: number = 1)
```

Update the radius and speed lines:
```ts
this.radiusX = (screenWidth * BALLOON_WIDTH_RATIO * sizeMultiplier) / 2;
this.radiusY = this.radiusX * BALLOON_ASPECT;

this.speed = (FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN)) * speedMultiplier;
this.screenHeight = screenHeight;
```

Also update `updateFloating()` to increment `animTime` and stop finale balloon at center:
```ts
private updateFloating(dt: number): void {
  if (!this.dragged) {
    // Finale balloon stops at screen center
    if (this.isFinale && this.y <= this.screenHeight / 2) {
      this.y = this.screenHeight / 2;
    } else {
      this.y -= this.speed * dt;
    }
    this.swayTime += dt;
    this.x = this.baseX + Math.sin(this.swayTime * SWAY_FREQUENCY * Math.PI * 2 + this.swayOffset) * SWAY_AMPLITUDE;
  }
  this.scaleX = 1;
  this.scaleY = 1;
  this.animTime += dt;
}
```

- [ ] **Step 2: Add factory methods for special and finale balloons**

Add static factory methods after the constructor:
```ts
static createSpecial(screenWidth: number, screenHeight: number, type: SpecialType): Balloon {
  const speedMul = SPECIAL_SPEED_MULTIPLIER;
  const sizeMul = type === 'rainbow' ? SPECIAL_RAINBOW_SIZE_MULTIPLIER : 1;
  const b = new Balloon(screenWidth, screenHeight, speedMul, sizeMul);
  b.specialType = type;
  b.number = 1; // Single tap to pop
  return b;
}

static createFinale(screenWidth: number, screenHeight: number): Balloon {
  const b = new Balloon(screenWidth, screenHeight, 1, FINALE_BALLOON_SIZE_MULTIPLIER);
  b.isFinale = true;
  b.number = 1;
  // Override position and speed for finale
  b.x = screenWidth / 2;
  b.baseX = screenWidth / 2;
  b.speed = FINALE_BALLOON_SPEED;
  return b;
}
```

- [ ] **Step 3: Override color getter for special types**

Replace the `color` getter:
```ts
get color(): string {
  if (this.specialType) {
    switch (this.specialType) {
      case 'star': return SPECIAL_STAR_COLOR;
      case 'animal-cat': return SPECIAL_CAT_COLOR;
      case 'animal-frog': return SPECIAL_FROG_COLOR;
      case 'animal-bird': return SPECIAL_BIRD_COLOR;
      case 'rainbow': return '#FF4444'; // Fallback; rainbow uses gradient rendering
    }
  }
  return BALLOON_COLORS[this.number] || BALLOON_COLORS[1];
}
```

Add the color imports to the top:
```ts
import {
  // ... existing imports ...
  SPECIAL_STAR_COLOR,
  SPECIAL_CAT_COLOR,
  SPECIAL_FROG_COLOR,
  SPECIAL_BIRD_COLOR,
} from './constants';
```

- [ ] **Step 4: Make special balloons non-draggable**

In `hitTest()`, keep it the same (hit detection still works). In `game.ts` later, we'll skip setting `dragged` for specials. But we should also add a convenience property:

Add to the class:
```ts
get isDraggable(): boolean {
  return !this.specialType && !this.isFinale;
}
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/balloon.ts
git commit -m "feat: extend Balloon with specialType, isFinale, and factory methods"
```

---

### Task 10: Add Special Balloon Rendering

**Files:**
- Modify: `src/renderer.ts`

- [ ] **Step 1: Add imports for special balloon constants**

In `src/renderer.ts`, add to imports:
```ts
import {
  // ... existing imports ...
  RAINBOW_GRADIENT_COLORS,
} from './constants';
```

- [ ] **Step 2: Route special balloons to dedicated rendering**

In `drawBalloon()`, add a check at the top (before the popping check):
```ts
drawBalloon(b: Balloon): void {
  if (b.state === 'popping') {
    this.drawPoppingBalloon(b);
    return;
  }

  if (b.specialType || b.isFinale) {
    this.drawSpecialBalloon(b);
    return;
  }

  // ... existing regular balloon rendering ...
}
```

- [ ] **Step 3: Implement drawSpecialBalloon**

Add method to `Renderer`:
```ts
private drawSpecialBalloon(b: Balloon): void {
  const ctx = this.ctx;
  const rx = b.radiusX * b.scaleX;
  const ry = b.radiusY * b.scaleY;

  ctx.save();
  ctx.translate(b.x, b.y);

  // Balloon body
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

  if (b.specialType === 'rainbow' || b.isFinale) {
    // Rainbow gradient
    const grad = ctx.createLinearGradient(-rx, -ry, rx, ry);
    RAINBOW_GRADIENT_COLORS.forEach((color, i) => {
      grad.addColorStop(i / (RAINBOW_GRADIENT_COLORS.length - 1), color);
    });
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = b.color;
  }
  ctx.fill();

  // Highlight shine — star balloons get oscillating shimmer
  const shimmerAlpha = b.specialType === 'star'
    ? 0.3 + 0.3 * Math.sin(b.animTime * 4) // Oscillating shimmer
    : 0.6;
  const shine = ctx.createRadialGradient(
    -rx * 0.3, -ry * 0.3, rx * 0.05,
    -rx * 0.1, -ry * 0.1, rx * 0.6
  );
  shine.addColorStop(0, `rgba(255, 255, 255, ${shimmerAlpha})`);
  shine.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  // Icon/face instead of number
  if (b.specialType === 'star') {
    this.drawStarIcon(rx, ry);
  } else if (b.specialType?.startsWith('animal-')) {
    this.drawAnimalFace(b.specialType, rx, ry);
  }
  // Rainbow and finale: no icon

  // Tie knot
  const knotY = ry;
  const knotSize = rx * 0.15;
  ctx.beginPath();
  ctx.moveTo(-knotSize, knotY);
  ctx.lineTo(knotSize, knotY);
  ctx.lineTo(0, knotY + knotSize * 2);
  ctx.closePath();
  ctx.fillStyle = b.isFinale ? RAINBOW_GRADIENT_COLORS[0] : b.color;
  ctx.fill();

  // String
  const stringLen = ry * STRING_LENGTH_RATIO;
  ctx.beginPath();
  ctx.moveTo(0, knotY + knotSize * 2);
  ctx.quadraticCurveTo(rx * 0.3, knotY + knotSize * 2 + stringLen * 0.5, 0, knotY + knotSize * 2 + stringLen);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 4: Add star icon drawing**

```ts
private drawStarIcon(rx: number, ry: number): void {
  const ctx = this.ctx;
  const size = Math.min(rx, ry) * 0.5;
  const spikes = 5;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.45;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();
}
```

- [ ] **Step 5: Add animal face drawing**

```ts
private drawAnimalFace(type: string, rx: number, ry: number): void {
  const ctx = this.ctx;
  const s = Math.min(rx, ry) * 0.4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  switch (type) {
    case 'animal-cat': {
      // Ears (two triangles)
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.3);
      ctx.lineTo(-s * 0.4, -s);
      ctx.lineTo(-s * 0.1, -s * 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.3);
      ctx.lineTo(s * 0.4, -s);
      ctx.lineTo(s * 0.7, -s * 0.3);
      ctx.fill();
      // Eyes
      ctx.beginPath();
      ctx.arc(-s * 0.25, 0, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.25, 0, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // "w" mouth
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, s * 0.25);
      ctx.lineTo(-s * 0.05, s * 0.4);
      ctx.lineTo(s * 0.05, s * 0.25);
      ctx.lineTo(s * 0.15, s * 0.4);
      ctx.lineTo(s * 0.3, s * 0.25);
      ctx.stroke();
      break;
    }
    case 'animal-frog': {
      // Big round eyes
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 0.15, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 0.15, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 0.15, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.3, -s * 0.15, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Wide smile
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.4, 0.1, Math.PI - 0.1);
      ctx.stroke();
      break;
    }
    case 'animal-bird': {
      // Dot eyes
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.1, s * 0.06, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.1, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Beak triangle
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.05);
      ctx.lineTo(-s * 0.15, s * 0.25);
      ctx.lineTo(s * 0.15, s * 0.25);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}
```

- [ ] **Step 6: Add special pop effects to drawPoppingBalloon**

Update `drawPoppingBalloon` to handle special balloon pop effects:

```ts
private drawPoppingBalloon(b: Balloon): void {
  const ctx = this.ctx;
  const t = b.popProgress;

  // Expanding and fading balloon body (same for all types)
  if (t < 0.5) {
    const expandT = t / 0.5;
    const scale = 1 + (POP_EXPAND_SCALE - 1) * expandT;
    const alpha = 1 - expandT;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);
    ctx.beginPath();
    ctx.ellipse(0, 0, b.radiusX * scale, b.radiusY * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.restore();
  }

  // Particles — star balloons get star-shaped, rainbow get multi-colored
  if (b.specialType === 'star') {
    this.drawStarParticles(b.particles);
  } else {
    this.drawParticles(b.particles);
  }

  // Animal silhouette floating up
  if (b.specialType?.startsWith('animal-') && t < 1) {
    this.drawAnimalSilhouette(b, t);
  }
}
```

Add star-shaped particle renderer:
```ts
private drawStarParticles(particles: Particle[]): void {
  const ctx = this.ctx;
  for (const p of particles) {
    if (p.age >= PARTICLE_LIFETIME) continue;
    const alpha = 1 - p.age / PARTICLE_LIFETIME;
    const twinkle = 0.5 + 0.5 * Math.sin(p.age * 12);
    ctx.save();
    ctx.globalAlpha = alpha * twinkle;
    ctx.translate(p.x, p.y);
    // 5-pointed star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const r = i % 2 === 0 ? p.radius : p.radius * 0.45;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.restore();
  }
}
```

Add animal silhouette renderer:
```ts
private drawAnimalSilhouette(b: Balloon, progress: number): void {
  const ctx = this.ctx;
  const floatY = b.y - progress * 150; // Float upward
  const alpha = 1 - progress;
  const scale = 1 + progress * 0.3; // Grow slightly

  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.translate(b.x, floatY);
  ctx.scale(scale, scale);
  const rx = b.radiusX;
  const ry = b.radiusY;
  this.drawAnimalFace(b.specialType!, rx, ry);
  ctx.restore();
}
```

- [ ] **Step 7: Update rainbow balloon particle colors**

In `src/balloon.ts`, update `spawnParticles()` to use rainbow colors for rainbow-type balloons:

```ts
private spawnParticles(): void {
  const count = PARTICLE_COUNT_MIN +
    Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1));
  const rainbowColors = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = PARTICLE_SPEED * (0.6 + Math.random() * 0.4);
    const color = this.specialType === 'rainbow' || this.isFinale
      ? rainbowColors[i % rainbowColors.length]
      : this.color;
    this.particles.push({
      x: this.x,
      y: this.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      color,
      radius: PARTICLE_SIZE * (0.7 + Math.random() * 0.6),
    });
  }
}
```

- [ ] **Step 8: Update imports for Balloon type**

Make sure `renderer.ts` imports `Balloon` properly — it already does via `import type { Balloon, Particle } from './balloon';`. The `specialType`, `isFinale`, and `animTime` fields will be accessible.

- [ ] **Step 9: Verify build passes and test visually**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/renderer.ts
git commit -m "feat: add special balloon and finale balloon rendering"
```

---

## Chunk 4: Surprise System — Manager, Event Rendering, Bubbles

### Task 11: Create Surprise Manager Core (TDD)

**Files:**
- Create: `src/surprise.ts`
- Create: `src/__tests__/surprise.test.ts`

- [ ] **Step 1: Write surprise counter tests**

Create `src/__tests__/surprise.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurpriseManager, SurpriseEventType } from '../surprise';

describe('SurpriseManager', () => {
  describe('tap counter', () => {
    it('does not fire event immediately', () => {
      const sm = new SurpriseManager();
      expect(sm.getActiveEvent()).toBeNull();
    });

    it('fires event after reaching threshold', () => {
      const sm = new SurpriseManager();
      // Threshold is 5-8, so after 8 taps an event must have fired
      let eventFired = false;
      for (let i = 0; i < 8; i++) {
        sm.incrementCounter(1);
        if (sm.hasPendingEvent()) {
          eventFired = true;
          break;
        }
      }
      expect(eventFired).toBe(true);
    });

    it('fires by 5 taps at minimum threshold', () => {
      // Force threshold to minimum by seeding
      const sm = new SurpriseManager();
      (sm as any).threshold = 5;
      (sm as any).counter = 0;
      for (let i = 0; i < 5; i++) {
        sm.incrementCounter(1);
      }
      expect(sm.hasPendingEvent()).toBe(true);
    });

    it('counts special balloon pops as 2', () => {
      const sm = new SurpriseManager();
      (sm as any).threshold = 5;
      (sm as any).counter = 0;
      sm.incrementCounter(2); // 2
      sm.incrementCounter(2); // 4
      sm.incrementCounter(1); // 5
      expect(sm.hasPendingEvent()).toBe(true);
    });
  });

  describe('event selection', () => {
    it('never repeats back-to-back', () => {
      const sm = new SurpriseManager();
      const events: SurpriseEventType[] = [];
      for (let i = 0; i < 20; i++) {
        // Force trigger
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../surprise`

- [ ] **Step 3: Implement SurpriseManager**

Create `src/surprise.ts`:
```ts
import {
  SURPRISE_COUNTER_MIN,
  SURPRISE_COUNTER_MAX,
  BUBBLE_COUNT_MIN,
  BUBBLE_COUNT_MAX,
  BUBBLE_RADIUS,
  BUBBLE_DURATION,
  RAINBOW_DURATION,
  CONFETTI_DURATION,
  STARBURST_DURATION,
  CONFETTI_COUNT,
  CONFETTI_WIDTH,
  CONFETTI_HEIGHT,
  STARBURST_COUNT_MIN,
  STARBURST_COUNT_MAX,
  STARBURST_STAR_SIZE,
  WIND_DOWN_GENTLE_WEIGHT,
} from './constants';

export type SurpriseEventType = 'rainbow' | 'confetti' | 'starburst' | 'bubbles' | 'silly';
export type SillySound = 'quack' | 'boing' | 'slideWhistle' | 'giggle';

const ALL_EVENTS: SurpriseEventType[] = ['rainbow', 'confetti', 'starburst', 'bubbles', 'silly'];
const GENTLE_EVENTS: SurpriseEventType[] = ['starburst', 'bubbles'];
const OTHER_EVENTS: SurpriseEventType[] = ['rainbow', 'confetti', 'silly'];
const ALL_SILLY: SillySound[] = ['quack', 'boing', 'slideWhistle', 'giggle'];

export interface Bubble {
  x: number;
  y: number;
  vy: number;
  radius: number;
  age: number;
  popped: boolean;
  popAge: number;
}

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  age: number;
}

export interface StarBurstStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  size: number;
}

export interface ActiveEvent {
  type: SurpriseEventType;
  age: number;
  duration: number;
  // Event-specific data
  sillySound?: SillySound;
  // Rainbow
  direction?: number; // 1 = left-to-right, -1 = right-to-left
  // Star burst
  originX?: number;
  originY?: number;
  stars?: StarBurstStar[];
  // Confetti
  confetti?: ConfettiPiece[];
  // Bubbles
  bubbles?: Bubble[];
}

const CONFETTI_COLORS = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF', '#AA44FF', '#FF69B4'];

export class SurpriseManager {
  private counter: number = 0;
  private threshold: number;
  private lastEventType: SurpriseEventType | null = null;
  private lastSillySound: SillySound | null = null;
  private pending: boolean = false;
  private activeEvent: ActiveEvent | null = null;
  private finaleEvents: ActiveEvent[] = []; // Multiple simultaneous events for finale
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  constructor() {
    this.threshold = this.randomThreshold();
  }

  private randomThreshold(): number {
    return SURPRISE_COUNTER_MIN + Math.floor(Math.random() * (SURPRISE_COUNTER_MAX - SURPRISE_COUNTER_MIN + 1));
  }

  incrementCounter(amount: number): void {
    if (this.pending) return; // Don't accumulate while an event is pending
    this.counter += amount;
    if (this.counter >= this.threshold) {
      this.pending = true;
      this.counter = 0;
      this.threshold = this.randomThreshold();
    }
  }

  hasPendingEvent(): boolean {
    return this.pending;
  }

  consumePendingEvent(lastPopX: number, lastPopY: number, windDown: boolean = false): SurpriseEventType | null {
    if (!this.pending) return null;
    if (this.activeEvent) return null; // Wait for current event to finish

    this.pending = false;
    const type = this.pickEvent(windDown);
    this.lastEventType = type;
    this.activeEvent = this.createEvent(type, lastPopX, lastPopY);
    return type;
  }

  private pickEvent(windDown: boolean): SurpriseEventType {
    let pool: SurpriseEventType[];

    if (windDown) {
      // 70% gentle (stars, bubbles), 30% other
      if (Math.random() < WIND_DOWN_GENTLE_WEIGHT) {
        pool = GENTLE_EVENTS.filter(e => e !== this.lastEventType);
        if (pool.length === 0) pool = OTHER_EVENTS;
      } else {
        pool = OTHER_EVENTS.filter(e => e !== this.lastEventType);
        if (pool.length === 0) pool = GENTLE_EVENTS;
      }
    } else {
      pool = ALL_EVENTS.filter(e => e !== this.lastEventType);
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickSillySound(): SillySound {
    const pool = ALL_SILLY.filter(s => s !== this.lastSillySound);
    const sound = pool[Math.floor(Math.random() * pool.length)];
    this.lastSillySound = sound;
    return sound;
  }

  private createEvent(type: SurpriseEventType, originX: number, originY: number): ActiveEvent {
    switch (type) {
      case 'rainbow':
        return {
          type, age: 0,
          duration: RAINBOW_DURATION,
          direction: Math.random() < 0.5 ? 1 : -1,
        };
      case 'confetti':
        return {
          type, age: 0,
          duration: CONFETTI_DURATION,
          confetti: this.spawnConfetti(),
        };
      case 'starburst':
        return {
          type, age: 0,
          duration: STARBURST_DURATION,
          originX, originY,
          stars: this.spawnStarBurst(originX, originY),
        };
      case 'bubbles':
        return {
          type, age: 0,
          duration: BUBBLE_DURATION,
          bubbles: this.spawnBubbles(),
        };
      case 'silly':
        return {
          type, age: 0,
          duration: 0.5,
          sillySound: this.pickSillySound(),
        };
    }
  }

  private spawnConfetti(): ConfettiPiece[] {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      pieces.push({
        x: Math.random() * this.screenWidth,
        y: -CONFETTI_HEIGHT - Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 60,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        age: 0,
      });
    }
    return pieces;
  }

  private spawnStarBurst(originX: number, originY: number): StarBurstStar[] {
    const count = STARBURST_COUNT_MIN +
      Math.floor(Math.random() * (STARBURST_COUNT_MAX - STARBURST_COUNT_MIN + 1));
    const stars: StarBurstStar[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 80 + Math.random() * 60;
      stars.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        size: STARBURST_STAR_SIZE * (0.7 + Math.random() * 0.6),
      });
    }
    return stars;
  }

  private spawnBubbles(): Bubble[] {
    const count = BUBBLE_COUNT_MIN +
      Math.floor(Math.random() * (BUBBLE_COUNT_MAX - BUBBLE_COUNT_MIN + 1));
    const bubbles: Bubble[] = [];
    for (let i = 0; i < count; i++) {
      bubbles.push({
        x: Math.random() * this.screenWidth,
        y: this.screenHeight + BUBBLE_RADIUS + Math.random() * 60,
        vy: -(40 + Math.random() * 40),
        radius: BUBBLE_RADIUS * (0.7 + Math.random() * 0.6),
        age: 0,
        popped: false,
        popAge: 0,
      });
    }
    return bubbles;
  }

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  update(dt: number): void {
    if (!this.activeEvent) return;
    this.activeEvent.age += dt;

    // Update event-specific state
    switch (this.activeEvent.type) {
      case 'confetti':
        if (this.activeEvent.confetti) {
          for (const c of this.activeEvent.confetti) {
            c.age += dt;
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.rotation += c.rotationSpeed * dt;
          }
        }
        break;
      case 'starburst':
        if (this.activeEvent.stars) {
          for (const s of this.activeEvent.stars) {
            s.age += dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
          }
        }
        break;
      case 'bubbles':
        if (this.activeEvent.bubbles) {
          for (const b of this.activeEvent.bubbles) {
            b.age += dt;
            if (b.popped) {
              b.popAge += dt;
            } else {
              b.y += b.vy * dt;
            }
          }
        }
        break;
    }

    // Check if event is done
    if (this.activeEvent.age >= this.activeEvent.duration) {
      this.activeEvent = null;
    }

    // Update finale events (multiple simultaneous)
    for (const fe of this.finaleEvents) {
      fe.age += dt;
      if (fe.type === 'confetti' && fe.confetti) {
        for (const c of fe.confetti) {
          c.age += dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rotation += c.rotationSpeed * dt;
        }
      }
      if (fe.type === 'starburst' && fe.stars) {
        for (const s of fe.stars) {
          s.age += dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }
      }
    }
    this.finaleEvents = this.finaleEvents.filter(fe => fe.age < fe.duration);
  }

  bubbleHitTest(x: number, y: number): boolean {
    if (!this.activeEvent || this.activeEvent.type !== 'bubbles' || !this.activeEvent.bubbles) return false;

    for (const b of this.activeEvent.bubbles) {
      if (b.popped) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) {
        b.popped = true;
        b.popAge = 0;
        return true;
      }
    }
    return false;
  }

  getActiveEvent(): ActiveEvent | null {
    return this.activeEvent;
  }

  getFinaleEvents(): ActiveEvent[] {
    return this.finaleEvents;
  }

  // Fire all three visual events simultaneously (for finale celebration)
  forceFinaleEvents(originX: number, originY: number): void {
    this.activeEvent = null; // Clear any normal event
    this.finaleEvents = [
      this.createEvent('rainbow', originX, originY),
      this.createEvent('confetti', originX, originY),
      this.createEvent('starburst', originX, originY),
    ];
  }

  reset(): void {
    this.counter = 0;
    this.pending = false;
    this.activeEvent = null;
    this.finaleEvents = [];
    this.lastEventType = null;
    this.lastSillySound = null;
    this.threshold = this.randomThreshold();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/surprise.ts src/__tests__/surprise.test.ts
git commit -m "feat: add SurpriseManager with tap counter, event pool, and bubble hit testing"
```

---

### Task 12: Add Surprise Event Rendering

**Files:**
- Modify: `src/renderer.ts`

- [ ] **Step 1: Add surprise event rendering methods**

In `src/renderer.ts`, add import:
```ts
import type { ActiveEvent, Bubble, ConfettiPiece, StarBurstStar } from './surprise';
```

Add new constants import:
```ts
import {
  // ... existing imports ...
  RAINBOW_GRADIENT_COLORS,
  RAINBOW_DURATION,
  STARBURST_DURATION,
  CONFETTI_DURATION,
  BUBBLE_DURATION,
  CONFETTI_WIDTH,
  CONFETTI_HEIGHT,
} from './constants';
```

Add method:
```ts
drawSurpriseEventBelow(event: ActiveEvent, width: number, height: number): void {
  // Events that render below balloons: rainbow, confetti, starburst
  switch (event.type) {
    case 'rainbow':
      this.drawRainbow(event, width, height);
      break;
    case 'confetti':
      this.drawConfetti(event);
      break;
    case 'starburst':
      this.drawStarBurst(event);
      break;
  }
}

drawSurpriseEventAbove(event: ActiveEvent): void {
  // Events that render above balloons: bubbles
  if (event.type === 'bubbles' && event.bubbles) {
    this.drawBubbles(event.bubbles, event.age, event.duration);
  }
}
```

- [ ] **Step 2: Implement rainbow rendering**

```ts
private drawRainbow(event: ActiveEvent, width: number, height: number): void {
  const ctx = this.ctx;
  const t = event.age / RAINBOW_DURATION;
  const dir = event.direction || 1;

  // Fade in (0-0.3), hold (0.3-0.7), fade out (0.7-1.0)
  let alpha: number;
  if (t < 0.3) alpha = t / 0.3;
  else if (t < 0.7) alpha = 1;
  else alpha = 1 - (t - 0.7) / 0.3;

  ctx.save();
  ctx.globalAlpha = alpha * 0.5;

  const cx = width / 2;
  const cy = height * 0.6;
  const baseRadius = Math.min(width, height) * 0.35;
  const bandWidth = baseRadius * 0.04;

  RAINBOW_GRADIENT_COLORS.forEach((color, i) => {
    const r = baseRadius - i * bandWidth * 2;
    if (r <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = bandWidth;
    ctx.stroke();
  });

  ctx.restore();
}
```

- [ ] **Step 3: Implement confetti rendering**

```ts
private drawConfetti(event: ActiveEvent): void {
  if (!event.confetti) return;
  const ctx = this.ctx;

  for (const c of event.confetti) {
    const alpha = 1 - c.age / CONFETTI_DURATION;
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);
    ctx.fillStyle = c.color;
    ctx.fillRect(-CONFETTI_WIDTH / 2, -CONFETTI_HEIGHT / 2, CONFETTI_WIDTH, CONFETTI_HEIGHT);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Implement star burst rendering**

```ts
private drawStarBurst(event: ActiveEvent): void {
  if (!event.stars) return;
  const ctx = this.ctx;

  for (const s of event.stars) {
    const alpha = 1 - s.age / STARBURST_DURATION;
    if (alpha <= 0) continue;

    // Twinkling: oscillate opacity
    const twinkle = 0.5 + 0.5 * Math.sin(s.age * 12);

    ctx.save();
    ctx.globalAlpha = alpha * twinkle;
    ctx.translate(s.x, s.y);

    // Draw 5-pointed star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const r = i % 2 === 0 ? s.size : s.size * 0.45;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    ctx.restore();
  }
}
```

- [ ] **Step 5: Implement bubble rendering**

```ts
private drawBubbles(bubbles: Bubble[], eventAge: number, duration: number): void {
  const ctx = this.ctx;

  for (const b of bubbles) {
    if (b.popped) {
      // Tiny splash animation
      if (b.popAge < 0.3) {
        const splashAlpha = 1 - b.popAge / 0.3;
        const splashR = b.radius * (1 + b.popAge * 3);
        ctx.save();
        ctx.globalAlpha = splashAlpha * 0.4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, splashR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 200, 255, 1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      continue;
    }

    const alpha = Math.min(1, 1 - (eventAge - duration + 0.5) / 0.5);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha * 0.35;

    // Bubble body
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150, 200, 255, 1)';
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.25, b.y - b.radius * 0.25, b.radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    ctx.restore();
  }
}
```

- [ ] **Step 6: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer.ts
git commit -m "feat: add surprise event rendering (rainbow, confetti, star burst, bubbles)"
```

---

## Chunk 5: Game Integration — Wire Everything, Finale, Play Again

### Task 13: Wire Session Manager and Surprise Manager into Game

**Files:**
- Modify: `src/game.ts`

- [ ] **Step 1: Add imports and new fields**

In `src/game.ts`, update imports:
```ts
import { Balloon, SpecialType } from './balloon';
import { Renderer } from './renderer';
import { AudioManager } from './audio';
import { SessionManager, Phase } from './session';
import { SurpriseManager, SurpriseEventType } from './surprise';
import {
  NUMBER_WEIGHTS,
  VIBRATE_DURATION,
  SPECIAL_SPAWN_CHANCE,
  SPECIAL_SURPRISE_INCREMENT,
  FINALE_WAIT_TIMEOUT,
  FINALE_TAP_DELAY,
  FINALE_CELEBRATION_DURATION,
  FINALE_FADE_DURATION,
} from './constants';
```

Add new fields (replace old gauge fields):
```ts
// Session and surprise systems
private session: SessionManager;
private surprise: SurpriseManager;
private previousPhase: Phase = 1;

// Surprise counter
private lastPopX: number = 0;
private lastPopY: number = 0;

// Finale state
private finaleState: 'none' | 'waiting' | 'balloon' | 'celebrating' | 'fading' | 'done' = 'none';
private finaleTimer: number = 0;
private finaleSpawnTime: number = 0;
```

In the constructor, add:
```ts
this.session = new SessionManager();
this.surprise = new SurpriseManager();
```

- [ ] **Step 2: Update the update() method**

Replace the `update()` method:
```ts
private update(dt: number): void {
  const phase = this.session.getPhase(this.elapsed);

  // Detect phase transition to finale
  if (phase === 4 && this.previousPhase !== 4) {
    this.enterFinale();
  }
  this.previousPhase = phase;

  // Handle finale states
  if (this.finaleState !== 'none') {
    this.updateFinale(dt);
  }

  // Spawn logic (only if not in finale)
  if (this.finaleState === 'none') {
    this.spawnTimer += dt;
    const spawnInterval = this.session.getSpawnInterval(this.elapsed);
    if (spawnInterval !== Infinity && this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnBalloon();
    }
  }

  // Update balloons
  for (const b of this.balloons) {
    b.update(dt);
  }

  // Remove off-screen and dead balloons
  this.balloons = this.balloons.filter(b => !b.isOffScreen() && !b.isDead());

  // Update surprise events
  this.surprise.update(dt);

  // Try to fire pending surprise event
  if (this.surprise.hasPendingEvent() && this.finaleState === 'none') {
    const windDown = phase === 3;
    const eventType = this.surprise.consumePendingEvent(this.lastPopX, this.lastPopY, windDown);
    if (eventType) {
      this.playSurpriseSound(eventType);
    }
  }
}
```

- [ ] **Step 3: Update spawnBalloon to handle specials and phase multipliers**

Replace `spawnBalloon()`:
```ts
private spawnBalloon(): void {
  const speedMul = this.session.getSpeedMultiplier(this.elapsed);
  const sizeMul = this.session.getSizeMultiplier(this.elapsed);

  // Check for special balloon
  const hasSpecialOnScreen = this.balloons.some(b => b.specialType !== undefined);
  if (!hasSpecialOnScreen && Math.random() < SPECIAL_SPAWN_CHANCE) {
    const types: SpecialType[] = ['star', 'animal-cat', 'animal-frog', 'animal-bird', 'rainbow'];
    const type = types[Math.floor(Math.random() * types.length)];
    const b = Balloon.createSpecial(this.width, this.height, type);
    this.balloons.push(b);
    return;
  }

  const b = new Balloon(this.width, this.height, speedMul, sizeMul);
  b.number = this.weightedRandomNumber();
  this.balloons.push(b);
}
```

- [ ] **Step 4: Update tapBalloon and handlePointerDown for specials**

Replace `tapBalloon()`:
```ts
private tapBalloon(b: Balloon): void {
  this.lastPopX = b.x;
  this.lastPopY = b.y;

  const isSpecial = b.specialType !== undefined;
  const result = b.tap();

  // Increment surprise counter
  const increment = isSpecial ? SPECIAL_SURPRISE_INCREMENT : 1;
  this.surprise.incrementCounter(increment);

  if (result === 'decremented') {
    this.audio.playTap();
  } else {
    this.audio.playPop();
    if (isSpecial) {
      this.playSpecialPopSound(b);
    }
    if (navigator.vibrate) {
      navigator.vibrate(VIBRATE_DURATION);
    }
  }
}
```

Update `handlePointerDown` to skip dragging specials:
```ts
private handlePointerDown(id: number, x: number, y: number): void {
  // Check bubbles first (non-consuming)
  const bubbleHit = this.surprise.bubbleHitTest(x, y);
  if (bubbleHit) {
    this.audio.playBubbleBloop();
  }

  const b = this.findBalloon(x, y);
  if (b) {
    // Finale balloon: check tap delay
    if (b.isFinale && this.elapsed - this.finaleSpawnTime < FINALE_TAP_DELAY) {
      return; // Ignore tap during delay
    }

    if (b.isDraggable) {
      b.dragged = true;
      this.drags.set(id, { balloon: b, startX: x, startY: y, moved: false });
    } else {
      // Special/finale balloons: tap immediately (no drag)
      this.tapBalloon(b);

      // Handle finale balloon pop
      if (b.isFinale) {
        this.startFinaleCelebration(b);
      }
    }
  }
}
```

- [ ] **Step 5: Add surprise sound and special pop sound methods**

```ts
private playSurpriseSound(type: SurpriseEventType): void {
  const event = this.surprise.getActiveEvent();
  switch (type) {
    case 'rainbow': this.audio.playRainbowWhoosh(); break;
    case 'confetti': this.audio.playConfettiPatter(); break;
    case 'starburst': this.audio.playStarSparkle(); break;
    case 'silly':
      if (event?.sillySound) {
        switch (event.sillySound) {
          case 'quack': this.audio.playQuack(); break;
          case 'boing': this.audio.playBoing(); break;
          case 'slideWhistle': this.audio.playSlideWhistle(); break;
          case 'giggle': this.audio.playGiggle(); break;
        }
      }
      break;
    // bubbles: no sound on spawn, only on individual bubble tap
  }
}

private playSpecialPopSound(b: Balloon): void {
  switch (b.specialType) {
    case 'star': this.audio.playStarChime(); break;
    case 'animal-cat': this.audio.playMeow(); break;
    case 'animal-frog': this.audio.playRibbit(); break;
    case 'animal-bird': this.audio.playTweet(); break;
    case 'rainbow': this.audio.playRainbowHarp(); break;
  }
}
```

- [ ] **Step 6: Add finale logic**

```ts
private enterFinale(): void {
  this.finaleState = 'waiting';
  this.finaleTimer = 0;
  // Force-release all drags
  for (const [id, drag] of this.drags) {
    drag.balloon.dragged = false;
  }
  this.drags.clear();
}

private updateFinale(dt: number): void {
  this.finaleTimer += dt;

  switch (this.finaleState) {
    case 'waiting':
      // Wait for screen to clear or timeout
      if (this.balloons.length === 0 || this.finaleTimer >= FINALE_WAIT_TIMEOUT) {
        this.balloons = [];
        this.spawnFinaleBalloon();
        this.finaleState = 'balloon';
      }
      break;
    case 'balloon':
      // Waiting for player to pop the finale balloon — handled in tapBalloon
      break;
    case 'celebrating':
      if (this.finaleTimer >= FINALE_CELEBRATION_DURATION) {
        this.finaleState = 'fading';
        this.finaleTimer = 0;
      }
      break;
    case 'fading':
      if (this.finaleTimer >= FINALE_FADE_DURATION) {
        this.finaleState = 'done';
        this.showPlayAgain();
      }
      break;
  }
}

private spawnFinaleBalloon(): void {
  const b = Balloon.createFinale(this.width, this.height);
  this.balloons.push(b);
  this.finaleSpawnTime = this.elapsed;
}

private startFinaleCelebration(b: Balloon): void {
  this.lastPopX = b.x;
  this.lastPopY = b.y;
  this.audio.playFinaleCelebration();
  // Fire all three visual surprise events simultaneously
  this.surprise.forceFinaleEvents(b.x, b.y);
  this.finaleState = 'celebrating';
  this.finaleTimer = 0;
}
```

- [ ] **Step 7: Update draw() for surprise events and finale fade**

Replace `draw()`:
```ts
private draw(): void {
  const ctx = this.ctx;
  ctx.save();
  ctx.scale(this.dpr, this.dpr);

  this.renderer.drawBackground(this.width, this.height);

  // Surprise events below balloons (rainbow, confetti, starburst)
  const event = this.surprise.getActiveEvent();
  if (event) {
    this.renderer.drawSurpriseEventBelow(event, this.width, this.height);
  }

  for (const b of this.balloons) {
    this.renderer.drawBalloon(b);
  }

  // Surprise events above balloons (bubbles)
  if (event) {
    this.renderer.drawSurpriseEventAbove(event);
  }

  // Finale celebration events (multiple simultaneous)
  for (const fe of this.surprise.getFinaleEvents()) {
    this.renderer.drawSurpriseEventBelow(fe, this.width, this.height);
  }

  // Finale fade overlay
  if (this.finaleState === 'fading') {
    const fadeAlpha = Math.min(1, this.finaleTimer / FINALE_FADE_DURATION);
    ctx.fillStyle = `rgba(135, 206, 235, ${fadeAlpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  ctx.restore();
}
```

- [ ] **Step 8: Add showPlayAgain and reset methods**

```ts
private showPlayAgain(): void {
  this.running = false;
  cancelAnimationFrame(this.rafId);
  const playAgainScreen = document.getElementById('play-again-screen');
  if (playAgainScreen) {
    playAgainScreen.classList.remove('hidden');
  }
}

reset(): void {
  this.balloons = [];
  this.elapsed = 0;
  this.spawnTimer = 0;
  this.previousPhase = 1;
  this.finaleState = 'none';
  this.finaleTimer = 0;
  this.finaleSpawnTime = 0;
  this.lastPopX = 0;
  this.lastPopY = 0;
  this.surprise.reset();
  this.surprise.setScreenSize(this.width, this.height);
  this.session.reset();
  for (const [, drag] of this.drags) {
    drag.balloon.dragged = false;
  }
  this.drags.clear();

  this.running = true;
  this.lastTime = performance.now();
  this.rafId = requestAnimationFrame(this.loop);
}
```

- [ ] **Step 9: Update start() to set screen size on surprise manager**

In `start()`, after `this.handleResize()`, add:
```ts
this.surprise.setScreenSize(this.width, this.height);
```

In `handleResize()`, add:
```ts
this.surprise.setScreenSize(this.width, this.height);
```

- [ ] **Step 10: Remove the old getSpawnInterval from Game**

Remove the `getSpawnInterval()` method from `Game` — spawn interval now comes from `this.session.getSpawnInterval(this.elapsed)` in `update()`.

- [ ] **Step 11: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add src/game.ts
git commit -m "feat: wire SessionManager and SurpriseManager into Game with finale sequence"
```

---

### Task 14: Add Play Again UI

**Files:**
- Modify: `index.html`
- Modify: `src/index.ts`

- [ ] **Step 1: Add play-again overlay to index.html**

In `index.html`, add after the `#start-screen` div (before `<canvas>`):
```html
<div id="play-again-screen" class="hidden">
  <button class="start-btn" id="play-again-btn">Play again!</button>
</div>
```

Add CSS for `#play-again-screen` (inside the `<style>` block):
```css
#play-again-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%);
  z-index: 10;
  transition: opacity 0.4s ease;
}
#play-again-screen.hidden {
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Update index.ts — hide instead of remove start screen**

In `src/index.ts`, change the start button handler. Replace:
```ts
startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  // Remove from DOM after fade-out transition
  startScreen.addEventListener('transitionend', () => {
    startScreen.remove();
  }, { once: true });
  game.start();
});
```

With:
```ts
startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  game.start();
});
```

- [ ] **Step 3: Add play-again button wiring**

Add to `src/index.ts`:
```ts
const playAgainBtn = document.getElementById('play-again-btn')!;
const playAgainScreen = document.getElementById('play-again-screen')!;

playAgainBtn.addEventListener('click', () => {
  playAgainScreen.classList.add('hidden');
  game.reset();
});
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.ts
git commit -m "feat: add play-again overlay and wire reset flow"
```

---

### Task 15: End-to-End Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual browser test**

Run: `npm run dev`

Test checklist:
- Start screen shows, "Play!" starts the game
- Balloons float up and can be tapped/dragged
- No gauge visible
- After 5-8 taps, a surprise event fires (rainbow, confetti, stars, bubbles, or silly sound)
- Special balloons appear occasionally (star, animal, rainbow)
- Special balloons pop in one tap with unique sounds
- Bubbles can be tapped (bloop sound)
- After ~5 min, balloons get bigger and slower
- After ~6.5 min, spawning stops and finale balloon appears
- Finale balloon pops with celebration
- "Play again!" button appears after fade
- Play again starts a fresh session

- [ ] **Step 4: Commit any fixes from manual testing**

If any issues found during testing, fix and commit:
```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
