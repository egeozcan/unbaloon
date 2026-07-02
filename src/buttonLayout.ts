import {
  HELI_BUTTON_MARGIN,
  HELI_BUTTON_RADIUS_RATIO,
  HELI_BUTTON_MIN_RADIUS,
  HELI_BUTTON_MAX_RADIUS,
} from './constants';

// The six vehicle spawn buttons (helicopter, plane, bulldozer, tractor, excavator,
// firefighter) form one vertical column down the left edge — index 0 = top
// (helicopter). The column is anchored at screen centre, matching the original
// two-button placement on normal screens, but slides up just enough to keep every
// button (touch target included) on-screen on short / landscape viewports, so no
// button is ever clipped or unreachable. Centralised here so all six managers stay
// in lockstep.

export const VEHICLE_BUTTON_COUNT = 6;

const TOUCH_SCALE = 1.25; // buttons use a 1.25× touch radius (see buttonHitTest)
// Centre-to-centre spacing is 2×TOUCH_SCALE×r plus a small constant gap, so
// neighbouring touch targets never overlap for any radius (the gap also keeps the
// margin comfortably clear of floating-point round-off). Non-overlap therefore
// holds by construction, leaving the radius free to shrink to fit the height.
const BTN_GAP = 2;        // CSS px clear space between adjacent touch targets
const MARGIN_Y = 6;       // CSS px breathing room above the top / below the bottom button

function slotFor(r: number): number {
  return 2 * TOUCH_SCALE * r + BTN_GAP;
}

export function vehicleButtonRadius(width: number, height: number): number {
  const byViewport = Math.min(width, height) * HELI_BUTTON_RADIUS_RATIO;
  // Largest radius that still lets the whole column (touch targets included) fit
  // the viewport height — this keeps every button on-screen even on short
  // landscape phones. Column height = (COUNT−1)·slot + 2·TOUCH_SCALE·r + 2·MARGIN_Y.
  const n = VEHICLE_BUTTON_COUNT;
  const byHeight = (height - (n - 1) * BTN_GAP - 2 * MARGIN_Y) / (2 * TOUCH_SCALE * n);
  const r = Math.min(byViewport, byHeight);
  const clamped = Math.max(HELI_BUTTON_MIN_RADIUS, Math.min(HELI_BUTTON_MAX_RADIUS, r));
  // Never let the min-radius floor push the column past what the height can hold:
  // on an extremely short viewport the buttons shrink below the floor rather than
  // clip off the bottom edge (keeps every touch target on-screen — see header).
  return Math.min(clamped, byHeight);
}

export function vehicleButtonX(width: number, height: number): number {
  return HELI_BUTTON_MARGIN + vehicleButtonRadius(width, height);
}

export function vehicleButtonY(index: number, width: number, height: number): number {
  const r = vehicleButtonRadius(width, height);
  const slot = slotFor(r);                     // centre-to-centre spacing
  const edge = TOUCH_SCALE * r + MARGIN_Y;     // keep the touch target on-screen
  const ideal = height / 2;                    // top button at centre (original)
  // Highest the top button may sit so the bottom button's touch target still fits.
  const maxTop = height - edge - slot * (VEHICLE_BUTTON_COUNT - 1);
  const top = Math.max(edge, Math.min(ideal, maxTop));
  return top + index * slot;
}

// Effect buttons (rain cloud, …) form a second column down the RIGHT edge,
// mirroring the vehicle column opposite it. They deliberately reuse the vehicle
// column's radius and vertical rhythm (vehicleButtonRadius/vehicleButtonY), so the
// two columns sit symmetrically and index 0 of each lines up horizontally.
// Mirrored x = the vehicle x reflected across the screen's vertical centre. (No
// separate count: the effect column borrows the vehicle column's slot layout; if
// it ever needs to grow independently, parameterise the column math on a count.)
export function effectButtonX(width: number, height: number): number {
  return width - HELI_BUTTON_MARGIN - vehicleButtonRadius(width, height);
}

export function effectButtonY(index: number, width: number, height: number): number {
  return vehicleButtonY(index, width, height);
}
