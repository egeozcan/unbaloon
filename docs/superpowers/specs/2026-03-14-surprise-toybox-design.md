# Surprise Toybox — Unbaloon Redesign

## Overview

Replace the score gauge / level progression system with a sensory "surprise toybox" experience. The game becomes a bounded ~7-minute play session with random moments of delight, special balloons, and a natural wind-down to a gentle finale. No scores, no levels, no escalation pressure.

**Target audience:** 3-year-old on a tablet/phone (touch input).

**Design goal:** Every tap produces satisfying feedback. Surprises come unpredictably. The session has a beginning, middle, and end — like a storybook, not a treadmill.

## What Changes

### Removed

- Score gauge (circular arc in top-right corner)
- Level counter and star display
- `speedMultiplier` / escalating difficulty
- All gauge-related constants (`GAUGE_*`)
- All gauge-related rendering and state (`gaugeCount`, `level`, `gaugeFlashTimer`, `incrementGauge()`, `drawGauge()`)

### Kept

- Core tap-to-decrement mechanic (balloons with numbers 1-5, tap to decrement, pop at 1)
- Squeeze animation on decrement
- Pop animation with expanding body + particles
- Drag to move balloons
- Start screen with Play / Fullscreen buttons
- Pause on visibility change
- Existing balloon colors and 3D highlight rendering

### Added

- Surprise event system
- Special balloon types
- Revised sound effects
- Session arc with natural wind-down and finale
- "Play again" screen

---

## Surprise Events

### Trigger

An internal (invisible to the player) tap counter increments by 1 on every tap interaction — whether it's a decrement tap or a final pop tap on a regular balloon. Every individual tap counts as 1 (so a number-5 balloon contributes 5 increments across its full lifecycle). Special balloon pops count as 2 increments (since they're rarer). Every 5-8 increments (randomized per interval), a surprise event fires. The threshold is re-randomized each time an event fires.

### Event Pool

Five event types, selected randomly with no back-to-back repeats:

1. **Rainbow** — A rainbow arc streaks across the screen (left to right or right to left, randomized). Duration: ~1.5s. Fades in, holds briefly, fades out. Sound: breathy filtered noise whoosh.

2. **Confetti shower** — Colorful rectangular confetti particles spawn across the top of the screen and flutter down with slight rotation and horizontal drift. Duration: ~2s. Sound: gentle crinkly patter.

3. **Star burst** — A cluster of 10-15 small stars explodes outward from the position of the most recently popped balloon. Stars twinkle (oscillating opacity) as they drift outward and fade. Duration: ~1.5s. Sound: soft chime tones (tiny wind chime).

4. **Bubbles** — 8-12 translucent circles drift upward from the bottom of the screen at varying speeds. These are **interactive**: tapping a bubble pops it with a small "bloop" sound and a tiny splash animation. Untapped bubbles drift off the top of the screen. Duration: ~3s. Sound on tap: hollow water-drop resonant sine with pitch dip. Bubbles do not consume taps — if a bubble overlaps a balloon, the tap pops the bubble AND passes through to the balloon beneath.

5. **Silly sound** — No visual effect. A funny synthesized sound plays: duck quack, boing, slide whistle, or giggle. Randomly selected (no back-to-back repeat within the silly sound sub-pool either). Duration: ~0.5s.

### Rendering

- Events render on a layer above the background but below balloons, except bubbles which render above balloons (so they're easy to tap)
- Events do not pause or interrupt normal balloon gameplay
- Multiple events never overlap — if the counter triggers while an event is still playing, it waits until the current event finishes

---

## Special Balloons

### Spawn Rules

- Approximately 1 in 10 spawned balloons is a special balloon (10% chance per spawn)
- Maximum 1 special balloon on screen at a time; if one exists, regular balloons spawn instead
- Special balloons have no number — they pop in a single tap
- They float ~30% slower than regular balloons (easier to spot and catch)
- They are not draggable (keeps interaction simple — just tap)
- They use the same hit-test ellipse as regular balloons

### Types

Selected randomly with equal probability:

1. **Star balloon**
   - Appearance: golden/yellow (#FFD700) with a subtle shimmer effect (oscillating highlight opacity)
   - Displays a star symbol instead of a number
   - Pop effect: burst of 10-12 small star-shaped particles that twinkle and fade over ~1s
   - Sound: gentle bell tap with slow decay

2. **Animal balloon**
   - Appearance: comes in 3 sub-types, randomly selected:
     - Cat: pink (#FF9999), displays a simple cat face (two triangles for ears, dots for eyes, a "w" mouth — drawn with basic canvas paths)
     - Frog: green (#44BB44), displays a simple frog face (two circles for eyes, wide curved mouth)
     - Bird: blue (#88BBFF), displays a simple bird face (small beak triangle, dot eyes)
   - Pop effect: a silhouette of the animal (same face, solid color, slightly larger) floats upward and off screen over ~1.5s while fading
   - Sound: synth approximation of the animal — cat: descending pitch bend, frog: two quick low-pitched blips, bird: fast high trill

3. **Rainbow balloon**
   - Appearance: slightly larger than regular balloons (~20% bigger radius). Rendered with a multicolor gradient fill cycling through red, orange, yellow, green, blue, purple
   - Displays no number or symbol
   - Pop effect: same particle burst as regular pop, but each particle is a different color from the rainbow palette
   - Sound: quick ascending sequence of pure sine tones (~5 notes over 0.8s), like a toy xylophone glissando

### Interaction with Surprise Counter

Popping a special balloon counts as 2 taps toward the surprise event counter (since they're rarer, they should feel extra rewarding).

---

## Sound Design

All sounds synthesized via Web Audio API. No external audio files. All sounds gentle — max gain ~0.3, no harsh attacks. Designed for a child at arm's length from a tablet speaker.

### Reworked Existing Sounds

**Pop (replaces current descending sine sweep):**
A real pop should feel like a small burst of air.
- Layer 1: white noise burst, ~30ms duration, sharp attack, fast exponential decay
- Layer 2: mid-frequency sine oscillator (~300 Hz), ~20ms, slight pitch drop
- Combined gain: ~0.25
- Result: a soft "pff" sound

**Tap/decrement (replaces current 800 Hz blip):**
A softer, warmer "bonk" — finger on rubber.
- Sine oscillator at ~400 Hz
- Quick attack, ~60ms decay
- Gain: ~0.2
- Result: a round, muted "donk"

### New Sounds

| Sound | Technique | Duration | Gain |
|---|---|---|---|
| Rainbow whoosh | Band-pass filtered white noise, center freq sweeps 200-800 Hz, panned L→R | ~1s | 0.15 |
| Confetti patter | Rapid series of ~20 tiny noise bursts (2ms each) at random intervals over duration, high-pass filtered | ~1.5s | 0.1 |
| Star sparkle | 3-4 high sine tones (1200-2400 Hz range) in quick ascending sequence, each ~80ms with slow decay | ~0.5s | 0.15 |
| Bubble bloop | Sine at ~250 Hz with quick pitch dip to ~150 Hz over 80ms, slight reverb (delay feedback) | ~0.15s | 0.2 |
| Duck quack | Nasal-sounding oscillator (square wave ~300 Hz), band-pass filtered, two quick pulses ~60ms each | ~0.2s | 0.2 |
| Boing | Sine starting at ~600 Hz, rapid oscillating pitch decay (bouncing frequency envelope) | ~0.4s | 0.2 |
| Slide whistle | Sine ramps from ~300 Hz to ~1200 Hz then back down | ~0.5s | 0.2 |
| Giggle | Tremolo on a ~500 Hz sine (amplitude modulation at ~8 Hz), 3 short bursts | ~0.5s | 0.15 |
| Cat meow | Sine at ~700 Hz with pitch bend down to ~400 Hz over 200ms | ~0.25s | 0.2 |
| Frog ribbit | Two quick sine pulses at ~200 Hz, ~40ms each, 80ms apart | ~0.2s | 0.2 |
| Bird tweet | Fast sine trill alternating ~1800/2200 Hz, ~15ms per note, 6 notes | ~0.15s | 0.15 |
| Star balloon chime | Sine at ~1000 Hz with slow exponential decay (~0.5s), slight detuned second oscillator for shimmer | ~0.6s | 0.2 |
| Rainbow balloon harp | 5 ascending sine tones (C5-G5-C6-E6-G6), ~100ms each, overlapping | ~0.8s | 0.2 |
| Finale celebration | Star sparkle + rainbow whoosh + confetti patter layered simultaneously | ~2s | 0.2 each |

---

## Session Arc

The game follows a ~7-minute arc. Timing is approximate — no visible timer or countdown.

### Phase 1: Ramp Up (0:00 - 2:00)

- Spawn interval starts at 2.0s (current `SPAWN_INTERVAL_START`)
- Gradually decreases to 1.0s (current `SPAWN_INTERVAL_END`)
- Balloon speed: each balloon still gets a random speed between `FLOAT_SPEED_MIN` and `FLOAT_SPEED_MAX` (keeps visual variety). Speed multiplier = 1.0, size multiplier = 1.0
- First surprise event likely fires around 0:30-1:00

### Phase 2: Cruising (2:00 - 5:00)

- Spawn interval holds steady at 1.0s
- Speed multiplier = 1.0, size multiplier = 1.0
- Full variety of surprise events and special balloons
- This is the "heart" of the play session

### Phase 3: Wind Down (5:00 - ~6:30)

- Spawn interval gradually increases back toward 2.0-2.5s
- Speed multiplier = 0.7 (30% slower), size multiplier = 1.2 (20% bigger = easier and more satisfying to pop)
- Surprise events still fire but skew toward the gentler ones: 70% chance of stars or bubbles, 30% chance of rainbow/confetti/silly sound

### Phase 4: Finale (~6:30 - 7:00)

- Regular balloon spawning stops
- All active drags are force-released
- Remaining balloons are allowed to float off or be popped
- Once the screen is clear, or after `FINALE_WAIT_TIMEOUT` (5 seconds) — whichever comes first — any remaining balloons are removed and one **finale balloon** spawns:
  - Implemented as a `Balloon` instance with `isFinale: true` flag (separate from `specialType` — it has unique behavior)
  - Extra large (~2x normal radius)
  - Rainbow-colored (same gradient as rainbow special balloon)
  - Floats very slowly up the center of the screen
  - Untappable for the first 0.5s after appearing — implemented via a `finaleSpawnTime` timestamp on `Game`; hit-test returns false while `elapsed - finaleSpawnTime < 0.5`
  - Single tap to pop after the brief delay
- On pop: all surprise events fire simultaneously (rainbow + confetti + stars), finale celebration sound plays
- After celebration fades (~3s), screen gently fades to the sky gradient background

### Play Again Screen

- After the finale fade-out, a DOM overlay fades in with a "Play again!" button (same visual style as start screen button)
- No score, no stats, no "you popped X balloons"
- Tapping it calls `Game.reset()` which starts a completely fresh session from Phase 1
- If the child walks away, the screen just sits peacefully on the sky gradient — no nagging

### Session Timer and Visibility

The existing `elapsed` field in `Game` becomes the session timer — it drives both spawn interval logic and phase transitions. Since the game loop already pauses on `visibilitychange`, elapsed time only counts active play time. This means a child who backgrounds the app repeatedly will experience the full ~7 minutes of active play, which may stretch longer in wall-clock time. This is acceptable — the session is bounded by play engagement, not wall clock.

On `Game.reset()`, `elapsed` resets to 0 along with all other session state.

### Implementation

- `elapsed` is the single session timer (no separate timer)
- Define phase boundaries as constants: `PHASE_1_END = 120`, `PHASE_2_END = 300`, `PHASE_3_END = 390`, `FINALE_WAIT_TIMEOUT = 5`
- `SPAWN_RAMP_DURATION` changes from 180 to 120 (ramp completes by end of Phase 1)
- Compute spawn interval and balloon speed as functions of `elapsed` and current phase
- The finale balloon is a flag-triggered one-time spawn

---

## Architecture Notes

### New Modules

- `src/surprise.ts` — Surprise event system: event pool, trigger counter, event state/animation, rendering. Exports a `SurpriseManager` class that `Game` owns. Includes bubble state and hit testing. Has a `reset()` method for session restart.
- `src/session.ts` — Session arc state machine. Tracks current phase based on `elapsed` time passed in from `Game`. Exposes `getPhase()`, `getSpawnInterval()`, `getSpeedMultiplier()`, `getSizeMultiplier()` methods. Has a `reset()` method. Does not own the timer — reads elapsed time from Game. `Game` is responsible for detecting phase transitions (comparing previous phase to current) and executing side effects (stopping spawns, force-releasing drags, spawning finale balloon). `SessionManager` is a pure query object — it does not drive actions.

### Modified Modules

- `src/game.ts` — Remove gauge state and `incrementGauge()`. Add `SurpriseManager`, `SessionManager`. Route tap events through surprise counter. Handle finale sequence. Add `reset()` method that clears all balloons, resets elapsed time, resets surprise/session managers, clears active events, and re-enters the spawn loop. The start screen is hidden (not removed from DOM) so it can be re-shown on reset.
- `src/renderer.ts` — Remove `drawGauge()`. Add methods for surprise event rendering (rainbow arc, confetti, star burst, bubbles). Add special balloon rendering (star shimmer, animal faces, rainbow gradient). Add finale rendering.
- `src/balloon.ts` — Add optional `specialType?: 'star' | 'animal-cat' | 'animal-frog' | 'animal-bird' | 'rainbow'` discriminated union field. When set, balloon has `number = 1` (pops on first tap) and no number is rendered. Phase multipliers for speed and size are passed via constructor at spawn time — already-on-screen balloons keep their original speed/size (phase transitions affect new spawns only).
- `src/audio.ts` — Replace `playTap()` and `playPop()` with reworked versions. Add methods for all new sounds (~15 new methods).
- `src/constants.ts` — Remove `GAUGE_*` constants. Add surprise event constants, special balloon constants, session phase timing constants, new sound parameters. Change `SPAWN_RAMP_DURATION` from 180 to 120.
- `src/index.ts` — Change start screen handling to hide (not remove from DOM). Add "play again" overlay with same styling. Wire both buttons to `Game.start()` / `Game.reset()`.
- `index.html` — Add "play again" overlay markup (hidden by default, same style as start screen).

### Bubble Tap Handling

Bubbles from the surprise event need their own hit-testing since they exist outside the balloon system. `SurpriseManager` exposes a `hitTest(x, y)` method that `Game` calls on every tap. Bubble taps do not consume the event — if a bubble overlaps a balloon, both the bubble and the balloon respond to the tap. This prevents frustration when bubbles drift over a balloon the child is targeting.

### Game.reset()

Resets all state for a new session:
- Clears `balloons` array
- Resets `elapsed` to 0
- Resets `spawnTimer` to 0
- Calls `SurpriseManager.reset()` (clears counter, active events, bubbles)
- Calls `SessionManager.reset()` (resets phase to Phase 1)
- Clears all active drags
- Restarts the game loop (sets `running = true`, resets `lastTime`, calls `requestAnimationFrame`)

`reset()` does NOT re-bind events — `bindEvents()` is called once in `start()` and remains bound for the lifetime of the page. `reset()` is a separate code path from `start()`.

`AudioManager` is preserved across resets — no need to recreate `AudioContext` (avoids re-requiring user gesture for autoplay policy).
