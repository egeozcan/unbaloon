export type InstallOutcome = 'accepted' | 'dismissed';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: InstallOutcome }>;
}

export interface PwaView {
  setInstallVisible(visible: boolean): void;
  setUpdateVisible(visible: boolean): void;
  setUpdateApplying(applying: boolean): void;
  setIosInstructionsVisible(visible: boolean): void;
}

export interface ServiceWorkerCallbacks {
  immediate?: boolean;
  onNeedRefresh(): void;
  onRegisterError(error: unknown): void;
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;
export type RegisterServiceWorker = (
  callbacks: ServiceWorkerCallbacks,
) => UpdateServiceWorker;

export interface PwaLogger {
  warn(message: string, error: unknown): void;
}

export interface PwaControllerOptions {
  view: PwaView;
  events: EventTarget;
  registerServiceWorker: RegisterServiceWorker;
  isIosSafari: boolean;
  isInstalled: boolean;
  logger?: PwaLogger;
}

export function isIosSafari(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  const iosDevice = /iPad|iPhone|iPod/.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
  const webkit = /AppleWebKit/.test(userAgent);
  const safari = /Version\/[\d.]+(?: .*Mobile\/\S+)? Safari\/[\d.]+/.test(userAgent);
  const nonSafariContext = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|FBIOS|FB_IAB|Instagram/i.test(userAgent);
  return iosDevice && webkit && safari && !nonSafariContext;
}

export function isInstalledApp(
  matchMedia: (query: string) => { matches: boolean },
  navigatorStandalone: boolean,
): boolean {
  return navigatorStandalone
    || ['fullscreen', 'standalone', 'minimal-ui'].some((mode) => (
      matchMedia(`(display-mode: ${mode})`).matches
    ));
}

export class PwaController {
  private readonly view: PwaView;
  private readonly events: EventTarget;
  private readonly registerServiceWorker: RegisterServiceWorker;
  private readonly isIosSafari: boolean;
  private readonly logger: PwaLogger;
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private updateServiceWorker: UpdateServiceWorker = async () => {};
  private safePromptSurface = false;
  private installed: boolean;
  private installDismissed = false;
  private iosInstructionsVisible = false;
  private updateReady = false;
  private applyingUpdate = false;

  constructor(options: PwaControllerOptions) {
    this.view = options.view;
    this.events = options.events;
    this.registerServiceWorker = options.registerServiceWorker;
    this.isIosSafari = options.isIosSafari;
    this.installed = options.isInstalled;
    this.logger = options.logger ?? console;
  }

  initialize(): void {
    this.events.addEventListener(
      'beforeinstallprompt',
      this.handleBeforeInstallPrompt,
    );
    this.events.addEventListener('appinstalled', this.handleAppInstalled);

    try {
      this.updateServiceWorker = this.registerServiceWorker({
        immediate: true,
        onNeedRefresh: () => {
          this.updateReady = true;
          this.render();
        },
        onRegisterError: (error) => {
          this.logger.warn('PWA service worker registration failed', error);
        },
      });
    } catch (error) {
      this.logger.warn('PWA service worker setup failed', error);
    }

    this.render();
  }

  setSafePromptSurface(visible: boolean): void {
    this.safePromptSurface = visible;
    if (!visible) {
      this.iosInstructionsVisible = false;
    }
    this.render();
  }

  async install(): Promise<void> {
    if (
      !this.safePromptSurface
      || this.installed
      || this.installDismissed
    ) {
      return;
    }

    if (!this.installPrompt) {
      if (this.isIosSafari) {
        this.iosInstructionsVisible = true;
        this.render();
      }
      return;
    }

    const prompt = this.installPrompt;
    this.installPrompt = null;
    this.render();

    try {
      await prompt.prompt();
      await prompt.userChoice;
      this.installDismissed = true;
    } catch (error) {
      this.installDismissed = true;
      this.logger.warn('PWA install prompt failed', error);
    } finally {
      this.render();
    }
  }

  dismissIosInstructions(): void {
    this.iosInstructionsVisible = false;
    this.installDismissed = true;
    this.render();
  }

  async applyUpdate(): Promise<void> {
    if (!this.safePromptSurface || !this.updateReady || this.applyingUpdate) {
      return;
    }

    this.applyingUpdate = true;
    this.render();

    try {
      await this.updateServiceWorker(true);
    } catch (error) {
      this.applyingUpdate = false;
      this.logger.warn('PWA update activation failed', error);
      this.render();
    }
  }

  private handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    if (this.installed || this.installDismissed) {
      return;
    }
    this.installPrompt = event as BeforeInstallPromptEvent;
    this.render();
  };

  private handleAppInstalled = (): void => {
    this.installed = true;
    this.installPrompt = null;
    this.iosInstructionsVisible = false;
    this.render();
  };

  private render(): void {
    const canInstall = this.safePromptSurface
      && !this.applyingUpdate
      && !this.installed
      && !this.installDismissed
      && (this.installPrompt !== null || this.isIosSafari);
    const updateVisible = this.safePromptSurface
      && this.updateReady;

    this.view.setInstallVisible(canInstall);
    this.view.setUpdateApplying(this.applyingUpdate);
    this.view.setUpdateVisible(updateVisible);
    this.view.setIosInstructionsVisible(
      this.safePromptSurface && this.iosInstructionsVisible,
    );
  }
}
