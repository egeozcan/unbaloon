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
export const BALLOON_WIDTH_RATIO = 0.125;
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

// Tap animation — a gentle "squash & bounce" on tap: the balloon briefly gets a
// touch wider and shorter, then springs back. Kept subtle (and roughly
// volume-conserving) so it reads as a happy boing, never a stretched egg.
export const SQUEEZE_SCALE_X = 1.1;
export const SQUEEZE_SCALE_Y = 0.9;
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

// ── Bulldozer ────────────────────────────────────────────────────────────────
// A ground vehicle: it drives in behind the nearest balloon, shoves it into the
// nearer side wall, and crushes (taps) it in rhythmic bites once it is pinned.
export const BULLDOZER_LIFETIME = 30;   // seconds the bulldozer stays out
export const BULLDOZER_COOLDOWN = 35;   // seconds before it can be spawned again
export const BULLDOZER_SIZE_RATIO = 0.17; // body length relative to screen width
export const BULLDOZER_MIN_SIZE = 84;     // CSS px floor so it stays visible
export const BULLDOZER_FADE_DURATION = 1.2; // seconds it fades out at end of life
export const BULLDOZER_SPEED = 300;       // CSS px/s — drive speed while manoeuvring
export const BULLDOZER_PUSH_SPEED = 160;  // CSS px/s — how fast it shoves a balloon
export const BULLDOZER_TURN_RATE = 4.2;   // rad/s — how sharply it pivots to its heading
export const BULLDOZER_TRACK_SPEED = 11;  // rad/s (visual track/wheel spin)
// The blade sits this far in front of the body centre; a balloon's standoff
// (where the dozer lines up behind it) is its radius plus this reach, so the
// blade meets the balloon's near edge exactly.
export const BULLDOZER_BLADE_REACH_RATIO = 0.44; // of body length
// How close to the "behind the balloon" point the dozer must get before it
// commits to a push (relative to body length, so it scales with the sprite).
export const BULLDOZER_ENGAGE_RATIO = 0.3;
// Half-height of the blade's capture lane (relative to body length). Any balloon
// whose body overlaps this vertical band in front of the blade gets scooped, so
// the dozer can herd a whole row of balloons into the wall at once.
export const BULLDOZER_BLADE_HALF_RATIO = 0.34;
// A balloon counts as pinned (and gets crushed) once its centre is within its
// radius + this slack of the target wall.
export const BULLDOZER_PIN_SLACK = 6;     // CSS px
export const BULLDOZER_CRUSH_INTERVAL = 0.35; // seconds between crush "bites"

export const BULLDOZER_BODY_COLOR = '#F4B73E';   // construction yellow
export const BULLDOZER_BODY_DARK = '#CC8C1E';    // shading / button outline
export const BULLDOZER_CAB_COLOR = '#E0A02C';    // operator cab
export const BULLDOZER_WINDOW_COLOR = '#BFE3FF'; // glass (matches the others)
export const BULLDOZER_BLADE_COLOR = '#9AA4AE';  // steel blade
export const BULLDOZER_BLADE_DARK = '#6C757D';   // blade edge / shading
export const BULLDOZER_TRACK_COLOR = '#33383F';  // rubber tracks
export const BULLDOZER_WHEEL_COLOR = '#1F2329';  // wheel hubs
export const BULLDOZER_DETAIL_COLOR = '#2A2F38'; // exhaust stack, panel lines

// ── Tractor ──────────────────────────────────────────────────────────────────
// A ground vehicle that trundles back and forth along the very bottom of the
// screen towing a trailer. Floating balloons that touch the trailer (or are
// dragged onto it) are loaded into the bed, where they ride along and lose a
// layer every TRACTOR_PROCESS_INTERVAL until they pop.
export const TRACTOR_LIFETIME = 30;   // seconds the tractor stays out
export const TRACTOR_COOLDOWN = 35;   // seconds before it can be spawned again
export const TRACTOR_SIZE_RATIO = 0.16; // tractor body length relative to screen width
export const TRACTOR_MIN_SIZE = 84;     // CSS px floor so it stays visible
export const TRACTOR_FADE_DURATION = 1.2; // seconds it fades out at end of life
export const TRACTOR_SPEED = 130;       // CSS px/s — steady horizontal cruise
export const TRACTOR_WHEEL_SPIN = 7;    // rad/s (visual wheel spin while moving)
export const TRACTOR_EDGE_MARGIN = 6;   // CSS px from a wall where the rig reverses
// Trailer geometry, relative to the tractor body length (size):
export const TRACTOR_TRAILER_GAP_RATIO = 0.07;    // gap between tractor rear and trailer front
export const TRACTOR_TRAILER_LENGTH_RATIO = 1.7;  // length of the trailer bed
// How many balloons the bed holds at once; touching balloons are ignored when
// full. Two is the most that sit clear of each other on the bed (the bed width
// and balloon size both scale with screen width, so the ratio is fixed).
export const TRACTOR_CAPACITY = 2;
// Seconds a loaded balloon waits between losing each layer.
export const TRACTOR_PROCESS_INTERVAL = 0.7;

export const TRACTOR_BODY_COLOR = '#4CA33B';    // farm green
export const TRACTOR_BODY_DARK = '#387D2C';     // shading / button outline
export const TRACTOR_CAB_COLOR = '#5DB84A';     // lighter green cab
export const TRACTOR_WINDOW_COLOR = '#BFE3FF';  // glass (matches the others)
export const TRACTOR_WHEEL_COLOR = '#2A2F38';   // rubber tyres
export const TRACTOR_WHEEL_HUB = '#F4C430';     // sunny yellow hubs
export const TRACTOR_TRAILER_COLOR = '#D24F33'; // cheerful red trailer
export const TRACTOR_TRAILER_DARK = '#A2371F';  // trailer shading / rails
export const TRACTOR_DETAIL_COLOR = '#2A2F38';  // exhaust stack, panel lines
