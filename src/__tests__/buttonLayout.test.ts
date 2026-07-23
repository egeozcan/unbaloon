import { describe, expect, it } from 'vitest';
import { HelicopterManager } from '../helicopter';
import { PlaneManager } from '../plane';
import { BulldozerManager } from '../bulldozer';
import { TractorManager } from '../tractor';
import { ExcavatorManager } from '../excavator';
import { FiretruckManager } from '../firetruck';
import { RainCloudManager } from '../raincloud';
import { WheelLoaderManager } from '../wheelloader';
import { JeepManager } from '../jeep';
import { BackhoeManager } from '../backhoe';
import { WheeledExcavatorManager } from '../wheeledexcavator';
import { PurplePlaneManager } from '../purpleplane';

interface ButtonManager {
  setScreenSize(width: number, height: number): void;
  readonly buttonX: number;
  readonly buttonY: number;
  readonly buttonRadius: number;
}

function columns(width: number, height: number): [ButtonManager[], ButtonManager[]] {
  const left: ButtonManager[] = [
    new HelicopterManager(),
    new PlaneManager(),
    new BulldozerManager(),
    new TractorManager(),
    new ExcavatorManager(),
    new FiretruckManager(),
  ];
  const right: ButtonManager[] = [
    new RainCloudManager(),
    new WheelLoaderManager(),
    new JeepManager(),
    new BackhoeManager(),
    new WheeledExcavatorManager(),
    new PurplePlaneManager(),
  ];
  for (const button of [...left, ...right]) button.setScreenSize(width, height);
  return [left, right];
}

describe('balanced summon button columns', () => {
  it('places six aligned buttons on each side', () => {
    const [left, right] = columns(800, 600);
    expect(left).toHaveLength(6);
    expect(right).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(left[i].buttonX).toBeLessThan(400);
      expect(right[i].buttonX).toBeGreaterThan(400);
      expect(left[i].buttonY).toBeCloseTo(right[i].buttonY, 8);
      expect(left[i].buttonRadius).toBeCloseTo(right[i].buttonRadius, 8);
      expect(left[i].buttonX + right[i].buttonX).toBeCloseTo(800, 8);
    }
  });

  it('keeps every touch target visible and non-overlapping', () => {
    const viewports = [
      [375, 667], [800, 600], [1400, 1024], [320, 480],
      [667, 375], [568, 320], [812, 375], [480, 300],
    ];
    for (const [width, height] of viewports) {
      const [left, right] = columns(width, height);
      for (const column of [left, right]) {
        for (let i = 0; i < column.length; i++) {
          const button = column[i];
          const reach = button.buttonRadius * 1.25;
          expect(button.buttonX - reach).toBeGreaterThanOrEqual(-0.001);
          expect(button.buttonX + reach).toBeLessThanOrEqual(width + 0.001);
          expect(button.buttonY - reach).toBeGreaterThanOrEqual(-0.001);
          expect(button.buttonY + reach).toBeLessThanOrEqual(height + 0.001);
          if (i > 0) {
            const previous = column[i - 1];
            const distance = Math.hypot(
              button.buttonX - previous.buttonX,
              button.buttonY - previous.buttonY,
            );
            expect(distance).toBeGreaterThanOrEqual((button.buttonRadius + previous.buttonRadius) * 1.25);
          }
        }
      }
    }
  });
});
