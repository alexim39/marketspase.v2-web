import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type InstallPlatform = 'android' | 'ios' | 'desktop' | 'other';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    /** Captured by the small script in index.html before Angular boots. */
    __msInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const detectInstallPlatform = (
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): InstallPlatform => {
  const ua = String(userAgent ?? '');
  if (/iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'other';
};

/**
 * PWA install state for the platform app.
 *
 * Desktop Chrome/Edge and Android Chrome expose `beforeinstallprompt`; iOS
 * Safari has no prompt and uses Share → Add to Home Screen instead. The event
 * is captured in index.html before Angular boots so the in-app action works
 * even if the browser fires it early.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly promptEvent = signal<BeforeInstallPromptEvent | null>(null);

  readonly installed = signal(false);
  readonly isStandalone = signal(false);
  readonly platform = signal<InstallPlatform>('other');
  readonly canInstall = computed(() => this.promptEvent() !== null && !this.installed());
  readonly isIos = computed(() => this.platform() === 'ios');
  readonly isAndroid = computed(() => this.platform() === 'android');
  readonly isDesktop = computed(() => this.platform() === 'desktop');

  private readonly onPrompt = (event: Event) => {
    const prompt = event as BeforeInstallPromptEvent;
    prompt.preventDefault();
    this.promptEvent.set(prompt);
  };

  private readonly onPromptReady = () => {
    if (window.__msInstallPrompt) this.promptEvent.set(window.__msInstallPrompt);
  };

  private readonly onInstalled = () => {
    this.installed.set(true);
    this.promptEvent.set(null);
  };

  private readonly onDisplayModeChange = () => this.syncStandalone();

  constructor() {
    if (typeof window === 'undefined') return;
    this.platform.set(detectInstallPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints ?? 0,
    ));
    this.syncStandalone();
    if (window.__msInstallPrompt) this.promptEvent.set(window.__msInstallPrompt);

    window.addEventListener('beforeinstallprompt', this.onPrompt as EventListener);
    window.addEventListener('ms-installprompt-ready', this.onPromptReady);
    window.addEventListener('appinstalled', this.onInstalled);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', this.onDisplayModeChange);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', this.onPrompt as EventListener);
      window.removeEventListener('ms-installprompt-ready', this.onPromptReady);
      window.removeEventListener('appinstalled', this.onInstalled);
      media.removeEventListener?.('change', this.onDisplayModeChange);
    });
  }

  private syncStandalone(): void {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.isStandalone.set(standalone);
    if (standalone) this.installed.set(true);
  }

  /** Opens the browser's native install prompt when one is available. */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const prompt = this.promptEvent();
    if (!prompt) return 'unavailable';
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      this.promptEvent.set(null);
      window.__msInstallPrompt = null;
      if (choice.outcome === 'accepted') this.installed.set(true);
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }
}
