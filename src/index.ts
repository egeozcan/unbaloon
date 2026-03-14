import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const startScreen = document.getElementById('start-screen')!;
const startBtn = document.getElementById('start-btn')!;
const fullscreenBtn = document.getElementById('fullscreen-btn')!;

const game = new Game(canvas);

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  game.start();
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    document.exitFullscreen();
    fullscreenBtn.textContent = 'Fullscreen';
  }
});

const playAgainBtn = document.getElementById('play-again-btn')!;
const playAgainScreen = document.getElementById('play-again-screen')!;

playAgainBtn.addEventListener('click', () => {
  playAgainScreen.classList.add('hidden');
  game.reset();
});
