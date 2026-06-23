// Balloon number → color mapping
export const BALLOON_COLORS: Record<number, string> = {
  1: '#FF4444',
  2: '#44BB44',
  3: '#FFD700',
  4: '#4488FF',
  5: '#AA44FF',
};

// Lighter highlight colors for 3D shine effect
export const BALLOON_HIGHLIGHTS: Record<number, string> = {
  1: '#FF9999',
  2: '#99DD99',
  3: '#FFEC80',
  4: '#99BBFF',
  5: '#CC99FF',
};

// Balloon sizing (relative to screen width)
export const BALLOON_WIDTH_RATIO = 0.14;
export const BALLOON_ASPECT = 1.25; // height = width * aspect

// Movement
export const FLOAT_SPEED_MIN = 60;  // CSS px/s
export const FLOAT_SPEED_MAX = 100;
export const SWAY_AMPLITUDE = 20;   // CSS px
export const SWAY_FREQUENCY = 0.8;  // Hz

// Spawning
export const SPAWN_INTERVAL_START = 2.0; // seconds
export const SPAWN_INTERVAL_END = 1.0;
export const SPAWN_RAMP_DURATION = 120;  // seconds — ramp completes at end of Phase 1

// Number distribution weights (index = number, value = weight)
export const NUMBER_WEIGHTS = [0, 5, 4, 3, 2, 1]; // more 1s and 2s

// Tap animation
export const SQUEEZE_SCALE_X = 0.8;
export const SQUEEZE_SCALE_Y = 1.2;
export const SQUEEZE_DURATION = 0.2; // seconds

// Pop animation
export const POP_EXPAND_SCALE = 1.3;
export const POP_DURATION = 0.35;    // seconds
export const PARTICLE_COUNT_MIN = 6;
export const PARTICLE_COUNT_MAX = 8;
export const PARTICLE_SPEED = 200;   // CSS px/s
export const PARTICLE_GRAVITY = 300; // CSS px/s²
export const PARTICLE_LIFETIME = 0.6; // seconds
export const PARTICLE_SIZE = 6;      // CSS px radius

// Vibration
export const VIBRATE_DURATION = 50; // ms

// Background gradient
export const BG_COLOR_TOP = '#87CEEB';    // sky blue
export const BG_COLOR_BOTTOM = '#E0F0FF'; // lighter blue

// String (the balloon string)
export const STRING_LENGTH_RATIO = 0.35; // relative to balloon height

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

// ── Helicopter ───────────────────────────────────────────────────────────────
export const HELICOPTER_LIFETIME = 30;   // seconds the helicopter stays out
export const HELICOPTER_COOLDOWN = 30;   // seconds before it can be spawned again
export const HELICOPTER_SIZE_RATIO = 0.2; // full width (incl. rotor) relative to screen width
export const HELICOPTER_MIN_SIZE = 80;    // CSS px floor so it stays visible/grabbable
export const HELICOPTER_FADE_DURATION = 1.2; // seconds it fades out at end of life
export const HELICOPTER_BOB_AMPLITUDE = 6;   // CSS px gentle hover bob
export const HELICOPTER_BOB_FREQUENCY = 0.9; // Hz
export const HELICOPTER_ROTOR_SPEED = 32;    // rad/s (visual spin)
export const HELICOPTER_GRAB_RADIUS_RATIO = 0.45; // grab hit radius relative to size

export const HELICOPTER_BODY_COLOR = '#3A6EA5';
export const HELICOPTER_WINDOW_COLOR = '#BFE3FF';
export const HELICOPTER_ROTOR_COLOR = '#2A2F38';
export const HELICOPTER_SKID_COLOR = '#2A2F38';

// Spawn button (left edge)
export const HELI_BUTTON_MARGIN = 16;          // CSS px from left edge
export const HELI_BUTTON_RADIUS_RATIO = 0.07;  // relative to min(width, height)
export const HELI_BUTTON_MIN_RADIUS = 30;      // CSS px floor
export const HELI_BUTTON_MAX_RADIUS = 52;      // CSS px cap

// ── Darts ────────────────────────────────────────────────────────────────────
export const DART_FIRE_INTERVAL = 0.45; // seconds between shots
export const DART_SPEED = 450;          // CSS px/s (projectile speed)
export const DART_LENGTH = 16;          // CSS px (visual)
export const DART_WIDTH = 4;            // CSS px (visual)
export const DART_LIFETIME = 2.5;       // seconds — hard backstop cull
export const DART_COLOR = '#333A44';
export const DART_TIP_COLOR = '#FF5A3C';
export const DART_MUZZLE_OFFSET_RATIO = 0.2; // fire from this far in front of heli center

// Effective reach: the helicopter only targets/hits balloons within this radius,
// and darts fizzle out once they have travelled this far.
export const DART_RANGE_RATIO = 0.5;  // of min(screen width, height)
export const DART_RANGE_MIN = 220;    // CSS px floor
export const DART_RANGE_MAX = 420;    // CSS px cap
// Aim is imperfect: each shot deviates by up to ±this many radians (~7.5°).
export const DART_SPREAD = 0.13;

// ── Plane ──────────────────────────────────────────────────────────────────────
export const PLANE_LIFETIME = 30;   // seconds the plane stays out
export const PLANE_COOLDOWN = 35;   // seconds before it can be spawned again
export const PLANE_SIZE_RATIO = 0.18; // full length (incl. wings) relative to screen width
export const PLANE_MIN_SIZE = 70;     // CSS px floor so it stays visible
export const PLANE_FADE_DURATION = 1.2; // seconds it fades out at end of life
export const PLANE_SPEED = 360;       // CSS px/s — fast strafing speed
export const PLANE_TURN_RATE = 3.4;   // rad/s — how sharply it can bank/turn around
export const PLANE_PROP_SPEED = 42;   // rad/s (visual propeller spin)
// Each strafing run aims at a point this far past the focus point so the plane
// flies through and beyond it before turning around for the next pass. The
// waypoint is clamped on-screen so the plane never disappears mid-run.
export const PLANE_OVERSHOOT_RATIO = 0.32; // of min(screen width, height)
export const PLANE_OVERSHOOT_MIN = 170;    // CSS px floor
export const PLANE_OVERSHOOT_MAX = 340;    // CSS px cap
// Each run reverses direction and rotates by this much, so successive passes
// sweep around the focus point and attack from varied angles.
export const PLANE_RUN_TURN_BIAS = 0.6; // radians (~34°)
// The run ends (and reverses) once the plane gets within this distance of the
// run's waypoint — keeping the turnaround anchored to an on-screen point.
export const PLANE_ARRIVE_RADIUS = 44; // CSS px

export const PLANE_BODY_COLOR = '#E8533A';   // cheerful red-orange
export const PLANE_WING_COLOR = '#C2402B';
export const PLANE_WINDOW_COLOR = '#BFE3FF';
export const PLANE_ACCENT_COLOR = '#FFD23C'; // yellow trim stripe
export const PLANE_PROP_COLOR = '#2A2F38';

// Plane spawn button sits below the helicopter button (shares its sizing/x).
// Gap is wide enough that the generous (1.25×) touch targets never overlap even
// when the button radius is capped on large screens.
export const PLANE_BUTTON_GAP = 28; // CSS px vertical gap between the two buttons

// ── Missiles (plane) ───────────────────────────────────────────────────────────
export const MISSILE_FIRE_INTERVAL = 1.3; // seconds between launches
export const MISSILE_SPEED = 175;         // CSS px/s — slow, deliberate
export const MISSILE_TURN_RATE = 3.2;     // rad/s — homing agility
export const MISSILE_LIFETIME = 5.0;      // seconds — hard backstop cull
export const MISSILE_DAMAGE = 2;          // balloon layers destroyed per hit
export const MISSILE_LENGTH = 17;         // CSS px (visual half-length)
export const MISSILE_WIDTH = 7;           // CSS px (visual)
export const MISSILE_MUZZLE_OFFSET_RATIO = 0.28; // launch this far in front of plane centre
export const MISSILE_BODY_COLOR = '#566270';
export const MISSILE_NOSE_COLOR = '#FF5A3C';
export const MISSILE_FIN_COLOR = '#2A2F38';
export const MISSILE_FLAME_COLOR = '#FFB23C';
// The plane only locks onto balloons within this radius of itself when firing.
export const MISSILE_RANGE_RATIO = 0.7;   // of min(screen width, height) — generous
export const MISSILE_RANGE_MIN = 320;     // CSS px floor
export const MISSILE_RANGE_MAX = 720;     // CSS px cap
