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
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const fullscreenBtn = document.getElementById('fullscreen-btn') as HTMLButtonElement;
const playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement;
const playAgainScreen = document.getElementById('play-again-screen')!;
const installBtn = document.getElementById('install-btn') as HTMLButtonElement;
const iosInstallPanel = document.getElementById('ios-install-panel')!;
const dismissIosInstallBtn = document.getElementById('dismiss-ios-install-btn') as HTMLButtonElement;
const updateBtn = document.getElementById('update-btn') as HTMLButtonElement;
let updateApplying = false;
let iosInstallReturnFocus: HTMLElement | null = null;

function focusGameCanvas(): void {
  canvas.focus({ preventScroll: true });
}

function isHiddenFromUser(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current !== null) {
    if (current.classList.contains('hidden')) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

const view: PwaView = {
  setInstallVisible(visible) {
    installBtn.classList.toggle('hidden', !visible);
  },
  setUpdateVisible(visible) {
    updateBtn.classList.toggle('hidden', !visible);
  },
  setUpdateApplying(applying) {
    updateApplying = applying;
    startBtn.disabled = applying;
    playAgainBtn.disabled = applying;
    updateBtn.disabled = applying;
    updateBtn.textContent = applying ? 'Updating…' : 'Update available';
  },
  setIosInstructionsVisible(visible) {
    const wasVisible = !iosInstallPanel.classList.contains('hidden');
    iosInstallPanel.classList.toggle('hidden', !visible);

    if (visible && !wasVisible) {
      iosInstallReturnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dismissIosInstallBtn.focus({ preventScroll: true });
      return;
    }

    if (!visible && wasVisible) {
      const returnFocus = iosInstallReturnFocus;
      iosInstallReturnFocus = null;
      if (startScreen.classList.contains('hidden')) {
        if (document.activeElement === dismissIosInstallBtn) {
          dismissIosInstallBtn.blur();
        }
      } else if (
        returnFocus !== null
        && document.contains(returnFocus)
        && !isHiddenFromUser(returnFocus)
      ) {
        returnFocus.focus({ preventScroll: true });
      } else {
        startBtn.focus({ preventScroll: true });
      }
    }
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
  reloadPage: () => window.location.reload(),
});
pwa.initialize();
pwa.setSafePromptSurface(true);

const game = new Game(canvas, () => {
  playAgainScreen.classList.remove('hidden');
  pwa.setSafePromptSurface(true);
});

startBtn.addEventListener('click', () => {
  if (updateApplying) {
    return;
  }

  startScreen.classList.add('hidden');
  pwa.setSafePromptSurface(false);
  game.start();
  focusGameCanvas();
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
  if (updateApplying) {
    return;
  }

  playAgainScreen.classList.add('hidden');
  pwa.setSafePromptSurface(false);
  game.reset();
  focusGameCanvas();
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
