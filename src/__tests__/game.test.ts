import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../game';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Game presentation callback', () => {
  it('notifies the app shell when the play-again screen should appear', () => {
    const canvas = {
      getContext: () => ({}),
    } as unknown as HTMLCanvasElement;
    const onPlayAgain = vi.fn();
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    const game = new Game(canvas, onPlayAgain);
    const internalGame = game as unknown as {
      running: boolean;
      rafId: number;
      showPlayAgain(): void;
    };
    internalGame.running = true;
    internalGame.rafId = 42;

    internalGame.showPlayAgain();

    expect(internalGame.running).toBe(false);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });
});
