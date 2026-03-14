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
export const BALLOON_WIDTH_RATIO = 0.17;
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
