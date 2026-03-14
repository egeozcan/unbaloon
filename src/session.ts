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
        const t = Math.min(elapsed / SPAWN_RAMP_DURATION, 1);
        return SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * t;
      }
      case 2:
        return SPAWN_INTERVAL_END;
      case 3: {
        const phaseProgress = (elapsed - PHASE_2_END) / (PHASE_3_END - PHASE_2_END);
        return SPAWN_INTERVAL_END + (WIND_DOWN_SPAWN_INTERVAL - SPAWN_INTERVAL_END) * phaseProgress;
      }
      case 4:
        return Infinity;
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
