import {
  HELI_BUTTON_MARGIN,
  HELI_BUTTON_RADIUS_RATIO,
  HELI_BUTTON_MIN_RADIUS,
  HELI_BUTTON_MAX_RADIUS,
  VEHICLE_BUTTON_GAP,
} from './constants';

// The three vehicle spawn buttons (helicopter, plane, bulldozer) form one
// vertical column down the left edge — index 0 = top (helicopter). The column is
// anchored at screen centre, matching the original two-button placement on normal
// screens, but slides up just enough to keep every button (touch target included)
// on-screen on short / landscape viewports, so no button is ever clipped or
// unreachable. Centralised here so all three managers stay in lockstep.

export const VEHICLE_BUTTON_COUNT = 3;
const TOUCH_SCALE = 1.25; // buttons use a 1.25× touch radius (see buttonHitTest)

export function vehicleButtonRadius(width: number, height: number): number {
  const r = Math.min(width, height) * HELI_BUTTON_RADIUS_RATIO;
  return Math.max(HELI_BUTTON_MIN_RADIUS, Math.min(HELI_BUTTON_MAX_RADIUS, r));
}

export function vehicleButtonX(width: number, height: number): number {
  return HELI_BUTTON_MARGIN + vehicleButtonRadius(width, height);
}

export function vehicleButtonY(index: number, width: number, height: number): number {
  const r = vehicleButtonRadius(width, height);
  const slot = r * 2 + VEHICLE_BUTTON_GAP;            // centre-to-centre spacing
  const edge = r * TOUCH_SCALE + HELI_BUTTON_MARGIN;  // keep the touch target on-screen
  const ideal = height / 2;                           // top button at centre (original)
  // Highest the top button may sit so the bottom button's touch target still fits.
  const maxTop = height - edge - slot * (VEHICLE_BUTTON_COUNT - 1);
  const top = Math.max(edge, Math.min(ideal, maxTop));
  return top + index * slot;
}
