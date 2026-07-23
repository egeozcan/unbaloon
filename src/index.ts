import { registerSW } from 'virtual:pwa-register';
import { Game } from './game';
import {
  PwaController,
  PwaView,
  isInstalledApp,
  isIosSafari,
} from './pwa';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const startScreen = document.getElementById('start-screen')!;
const startBtn = document.getElementById('start-btn')!;
const fullscreenBtn = document.getElementById('fullscreen-btn')!;
const playAgainBtn = document.getElementById('play-again-btn')!;
const playAgainScreen = document.getElementById('play-again-screen')!;
const installBtn = document.getElementById('install-btn')!;
const iosInstallPanel = document.getElementById('ios-install-panel')!;
const dismissIosInstallBtn = document.getElementById('dismiss-ios-install-btn')!;
const updateBtn = document.getElementById('update-btn')!;

const view: PwaView = {
  setInstallVisible(visible) {
    installBtn.classList.toggle('hidden', !visible);
  },
  setUpdateVisible(visible) {
    updateBtn.classList.toggle('hidden', !visible);
  },
  setIosInstructionsVisible(visible) {
    iosInstallPanel.classList.toggle('hidden', !visible);
  },
};

const iosNavigator = navigator as Navigator & { standalone?: boolean };
const pwa = new PwaController({
  view,
  events: window,
  registerServiceWorker: registerSW,
  isIosSafari: isIosSafari(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  ),
  isInstalled: isInstalledApp(
    window.matchMedia.bind(window),
    iosNavigator.standalone === true,
  ),
});
pwa.initialize();
pwa.setSafePromptSurface(true);

const game = new Game(canvas, () => {
  playAgainScreen.classList.remove('hidden');
  pwa.setSafePromptSurface(true);
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  pwa.setSafePromptSurface(false);
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

playAgainBtn.addEventListener('click', () => {
  playAgainScreen.classList.add('hidden');
  pwa.setSafePromptSurface(false);
  game.reset();
});

installBtn.addEventListener('click', () => {
  void pwa.install();
});

dismissIosInstallBtn.addEventListener('click', () => {
  pwa.dismissIosInstructions();
});

updateBtn.addEventListener('click', () => {
  void pwa.applyUpdate();
});
