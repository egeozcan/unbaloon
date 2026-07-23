import { describe, expect, it, vi } from 'vitest';
import {
  BeforeInstallPromptEvent,
  PwaController,
  PwaControllerOptions,
  PwaView,
  RegisterServiceWorker,
  ServiceWorkerCallbacks,
  UPDATE_ACTIVATION_TIMEOUT_MS,
  isInstalledApp,
  isIosSafari,
} from '../pwa';

function displayMode(activeMode: string): (query: string) => { matches: boolean } {
  return (query) => ({ matches: query === `(display-mode: ${activeMode})` });
}

function makeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(async () => {});

  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome }) },
  });

  return { event, prompt };
}

function setup(overrides: Partial<PwaControllerOptions> = {}) {
  const events = new EventTarget();
  const view: PwaView = {
    setInstallVisible: vi.fn(),
    setUpdateVisible: vi.fn(),
    setUpdateApplying: vi.fn(),
    setIosInstructionsVisible: vi.fn(),
  };
  const updateServiceWorker = vi.fn(async (_reloadPage?: boolean) => {});
  let callbacks: ServiceWorkerCallbacks | undefined;
  const registerServiceWorker: RegisterServiceWorker = (options) => {
    callbacks = options;
    return updateServiceWorker;
  };
  const logger = { warn: vi.fn() };
  const reloadPage = vi.fn();
  const controller = new PwaController({
    view,
    events,
    registerServiceWorker,
    isIosSafari: false,
    isInstalled: false,
    logger,
    reloadPage,
    ...overrides,
  });

  controller.initialize();

  return {
    controller,
    events,
    view,
    updateServiceWorker,
    logger,
    reloadPage,
    getCallbacks: () => callbacks,
  };
}

describe('PWA platform detection', () => {
  it('recognizes iPhone Safari and desktop-mode iPad Safari', () => {
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    )).toBe(true);
    expect(isIosSafari(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      'MacIntel',
      5,
    )).toBe(true);
  });

  it('excludes non-iOS devices, iOS third-party browsers, and in-app browsers', () => {
    expect(isIosSafari(
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Safari/537.36',
      'Linux armv8l',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/130 Mobile/15E148 Safari/605.1.15',
      'iPhone',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 EdgiOS/130 Mobile/15E148 Safari/605.1.15',
      'iPhone',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 OPiOS/5.0 Mobile/15E148 Safari/605.1.15',
      'iPhone',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.0.1;FBBV/123456]',
      'iPhone',
      5,
    )).toBe(false);
    expect(isIosSafari(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.0.1',
      'iPhone',
      5,
    )).toBe(false);
  });

  it('recognizes fullscreen, standalone, minimal-ui, and iOS standalone installs', () => {
    expect(isInstalledApp(displayMode('fullscreen'), false)).toBe(true);
    expect(isInstalledApp(displayMode('standalone'), false)).toBe(true);
    expect(isInstalledApp(displayMode('minimal-ui'), false)).toBe(true);
    expect(isInstalledApp(displayMode('browser'), true)).toBe(true);
    expect(isInstalledApp(displayMode('browser'), false)).toBe(false);
  });
});

describe('PwaController', () => {
  it.each(['accepted', 'dismissed'] as const)(
    'captures the native prompt and hides it after it is %s',
    async (outcome) => {
      const { controller, events, view } = setup();
      const installPrompt = makeInstallPrompt(outcome);

      controller.setSafePromptSurface(true);
      events.dispatchEvent(installPrompt.event);

      expect(installPrompt.event.defaultPrevented).toBe(true);
      expect(view.setInstallVisible).toHaveBeenLastCalledWith(true);

      await controller.install();

      expect(installPrompt.prompt).toHaveBeenCalledOnce();
      expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
    },
  );

  it('keeps a rejected native install prompt non-fatal', async () => {
    const { controller, events, logger, view } = setup();
    const event = new Event('beforeinstallprompt', {
      cancelable: true,
    }) as BeforeInstallPromptEvent;
    const error = new Error('prompt failed');
    Object.defineProperties(event, {
      prompt: { value: vi.fn(async () => { throw error; }) },
      userChoice: { value: Promise.resolve({ outcome: 'dismissed' }) },
    });
    controller.setSafePromptSurface(true);
    events.dispatchEvent(event);

    await expect(controller.install()).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith('PWA install prompt failed', error);
    expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
  });

  it('hides installation after appinstalled', () => {
    const { controller, events, view } = setup();
    controller.setSafePromptSurface(true);
    events.dispatchEvent(makeInstallPrompt().event);

    events.dispatchEvent(new Event('appinstalled'));

    expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
  });

  it('opens dismissible iOS guidance only on a safe surface', async () => {
    const { controller, view } = setup({ isIosSafari: true });

    controller.setSafePromptSurface(true);
    expect(view.setInstallVisible).toHaveBeenLastCalledWith(true);

    await controller.install();
    expect(view.setIosInstructionsVisible).toHaveBeenLastCalledWith(true);

    controller.dismissIosInstructions();
    expect(view.setIosInstructionsVisible).toHaveBeenLastCalledWith(false);
    expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
  });

  it('does not show installation when already installed', () => {
    const { controller, events, view } = setup({
      isIosSafari: true,
      isInstalled: true,
    });

    controller.setSafePromptSurface(true);
    events.dispatchEvent(makeInstallPrompt().event);

    expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
  });

  it('defers a ready update during gameplay and reveals it on a safe screen', async () => {
    const { controller, view, updateServiceWorker, getCallbacks } = setup();
    controller.setSafePromptSurface(false);

    getCallbacks()?.onNeedRefresh();
    expect(view.setUpdateVisible).toHaveBeenLastCalledWith(false);

    controller.setSafePromptSurface(true);
    expect(view.setUpdateVisible).toHaveBeenLastCalledWith(true);

    await controller.applyUpdate();
    expect(updateServiceWorker).toHaveBeenCalledWith(false);
    expect(view.setUpdateApplying).toHaveBeenLastCalledWith(true);
    expect(view.setUpdateVisible).toHaveBeenLastCalledWith(true);

    getCallbacks()?.onNeedReload();
  });

  it('restores controls and retains the update action when controlling times out', async () => {
    vi.useFakeTimers();
    try {
      const {
        controller,
        view,
        logger,
        reloadPage,
        getCallbacks,
      } = setup();
      controller.setSafePromptSurface(true);
      getCallbacks()?.onNeedRefresh();

      await controller.applyUpdate();

      expect(view.setUpdateApplying).toHaveBeenLastCalledWith(true);
      expect(reloadPage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(UPDATE_ACTIVATION_TIMEOUT_MS);

      expect(view.setUpdateApplying).toHaveBeenLastCalledWith(false);
      expect(view.setUpdateVisible).toHaveBeenLastCalledWith(true);
      expect(logger.warn).toHaveBeenCalledWith(
        `PWA update activation timed out after ${UPDATE_ACTIVATION_TIMEOUT_MS} ms`,
        expect.any(Error),
      );
      expect(reloadPage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('defers a late controlling reload during gameplay until the next safe surface', async () => {
    vi.useFakeTimers();
    try {
      const { controller, reloadPage, getCallbacks } = setup();
      controller.setSafePromptSurface(true);
      getCallbacks()?.onNeedRefresh();
      await controller.applyUpdate();
      await vi.advanceTimersByTimeAsync(UPDATE_ACTIVATION_TIMEOUT_MS);

      controller.setSafePromptSurface(false);
      getCallbacks()?.onNeedReload();

      expect(reloadPage).not.toHaveBeenCalled();

      controller.setSafePromptSurface(true);
      getCallbacks()?.onNeedReload();
      controller.setSafePromptSurface(true);

      expect(reloadPage).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reloads once when controlling arrives on a safe surface and cancels the timeout', async () => {
    vi.useFakeTimers();
    try {
      const {
        controller,
        view,
        logger,
        reloadPage,
        getCallbacks,
      } = setup();
      controller.setSafePromptSurface(true);
      getCallbacks()?.onNeedRefresh();
      await controller.applyUpdate();

      getCallbacks()?.onNeedReload();
      getCallbacks()?.onNeedReload();
      await vi.advanceTimersByTimeAsync(UPDATE_ACTIVATION_TIMEOUT_MS);

      expect(reloadPage).toHaveBeenCalledOnce();
      expect(view.setUpdateApplying).toHaveBeenLastCalledWith(false);
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
        expect.anything(),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('locks synchronously, then cancels the timeout and restores controls on adapter rejection', async () => {
    vi.useFakeTimers();
    try {
      const activationError = new Error('activation failed');
      let rejectActivation: (error: Error) => void = () => {};
      const updateServiceWorker = vi.fn((_reloadPage?: boolean) => new Promise<void>((_resolve, reject) => {
        rejectActivation = reject;
      }));
      let callbacks: ServiceWorkerCallbacks | undefined;
      const registerServiceWorker: RegisterServiceWorker = (options) => {
        callbacks = options;
        return updateServiceWorker;
      };
      const logger = { warn: vi.fn() };
      const { controller, view } = setup({ registerServiceWorker, logger });

      controller.setSafePromptSurface(true);
      callbacks?.onNeedRefresh();

      const applying = controller.applyUpdate();

      expect(updateServiceWorker).toHaveBeenCalledWith(false);
      expect(view.setUpdateApplying).toHaveBeenLastCalledWith(true);
      expect(vi.getTimerCount()).toBe(1);

      rejectActivation(activationError);
      await applying;

      expect(logger.warn).toHaveBeenCalledWith(
        'PWA update activation failed',
        activationError,
      );
      expect(view.setUpdateApplying).toHaveBeenLastCalledWith(false);
      expect(view.setUpdateVisible).toHaveBeenLastCalledWith(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides iOS guidance when gameplay starts', async () => {
    const { controller, view } = setup({ isIosSafari: true });
    controller.setSafePromptSurface(true);
    await controller.install();

    controller.setSafePromptSurface(false);

    expect(view.setIosInstructionsVisible).toHaveBeenLastCalledWith(false);
    expect(view.setInstallVisible).toHaveBeenLastCalledWith(false);
  });

  it('keeps registration and update failures non-fatal', async () => {
    const registrationError = new Error('registration failed');
    const activationError = new Error('activation failed');
    const logger = { warn: vi.fn() };
    const updateServiceWorker = vi.fn(async () => {
      throw activationError;
    });
    let callbacks: ServiceWorkerCallbacks | undefined;
    const registerServiceWorker: RegisterServiceWorker = (options) => {
      callbacks = options;
      return updateServiceWorker;
    };
    const { controller, view } = setup({ registerServiceWorker, logger });

    callbacks?.onRegisterError(registrationError);
    controller.setSafePromptSurface(true);
    callbacks?.onNeedRefresh();

    await expect(controller.applyUpdate()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'PWA service worker registration failed',
      registrationError,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'PWA update activation failed',
      activationError,
    );
    expect(view.setUpdateVisible).toHaveBeenLastCalledWith(true);
  });

  it('continues when service-worker setup throws synchronously', () => {
    const logger = { warn: vi.fn() };
    const registerServiceWorker: RegisterServiceWorker = () => {
      throw new Error('unsupported');
    };

    expect(() => setup({ registerServiceWorker, logger })).not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
