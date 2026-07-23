export interface TwoLinkArmSolution {
  elbowX: number;
  elbowY: number;
  tipX: number;
  tipY: number;
  endAngle: number;
}

// Solve a two-segment arm in screen space. The requested tip is clamped into the
// reachable annulus and the higher elbow solution is chosen for a familiar
// construction-machine silhouette.
export function solveTwoLinkArm(
  shoulderX: number,
  shoulderY: number,
  requestedTipX: number,
  requestedTipY: number,
  firstLength: number,
  secondLength: number,
): TwoLinkArmSolution {
  const maxReach = firstLength + secondLength;
  const minReach = Math.abs(firstLength - secondLength) + 0.001;

  let dx = requestedTipX - shoulderX;
  let dy = requestedTipY - shoulderY;
  let distance = Math.hypot(dx, dy);
  if (distance < 1e-4) {
    dx = 0;
    dy = -1e-4;
    distance = 1e-4;
  }

  const clampedDistance = Math.max(minReach, Math.min(maxReach, distance));
  if (clampedDistance !== distance) {
    dx = (dx / distance) * clampedDistance;
    dy = (dy / distance) * clampedDistance;
    distance = clampedDistance;
  }

  const tipX = shoulderX + dx;
  const tipY = shoulderY + dy;
  const targetAngle = Math.atan2(dy, dx);
  const cosOffset = (
    distance * distance + firstLength * firstLength - secondLength * secondLength
  ) / (2 * firstLength * distance);
  const offset = Math.acos(Math.max(-1, Math.min(1, cosOffset)));
  const firstAngle = targetAngle - offset;
  const secondAngle = targetAngle + offset;
  const firstElbowY = shoulderY + Math.sin(firstAngle) * firstLength;
  const secondElbowY = shoulderY + Math.sin(secondAngle) * firstLength;
  const boomAngle = firstElbowY <= secondElbowY ? firstAngle : secondAngle;
  const elbowX = shoulderX + Math.cos(boomAngle) * firstLength;
  const elbowY = shoulderY + Math.sin(boomAngle) * firstLength;

  return {
    elbowX,
    elbowY,
    tipX,
    tipY,
    endAngle: Math.atan2(tipY - elbowY, tipX - elbowX),
  };
}
