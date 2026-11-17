import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __msStoreInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Store-scoped install state; the prompt is captured in index.html. */
@Injectable({ providedIn: 'root' })
export class StorePwaInstallService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly promptEvent = signal<BeforeInstallPromptEvent | null>(null);

  readonly installed = signal(false);
  readonly isStandalone = signal(false);
  readonly canInstall = computed(() => this.promptEvent() !== null && !this.installed());

  private readonly onPrompt = (event: Event) => {
    const prompt = event as BeforeInstallPromptEvent;
    prompt.preventDefault();
    this.promptEvent.set(prompt);
  };

  private readonly onPromptReady = () => {
    if (window.__msStoreInstallPrompt) this.promptEvent.set(window.__msStoreInstallPrompt);
  };

  private readonly onInstalled = () => {
    this.installed.set(true);
    this.promptEvent.set(null);
  };

  private readonly onDisplayModeChange = () => this.syncStandalone();

  constructor() {
    if (typeof window === 'undefined') return;
    this.syncStandalone();
    if (window.__msStoreInstallPrompt) this.promptEvent.set(window.__msStoreInstallPrompt);
    window.addEventListener('beforeinstallprompt', this.onPrompt as EventListener);
    window.addEventListener('ms-store-installprompt-ready', this.onPromptReady);
    window.addEventListener('appinstalled', this.onInstalled);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', this.onDisplayModeChange);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', this.onPrompt as EventListener);
      window.removeEventListener('ms-store-installprompt-ready', this.onPromptReady);
      window.removeEventListener('appinstalled', this.onInstalled);
      media.removeEventListener?.('change', this.onDisplayModeChange);
    });
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const prompt = this.promptEvent();
    if (!prompt) return 'unavailable';
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      this.promptEvent.set(null);
      window.__msStoreInstallPrompt = null;
      if (choice.outcome === 'accepted') this.installed.set(true);
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }

  private syncStandalone(): void {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    this.isStandalone.set(standalone);
    if (standalone) this.installed.set(true);
  }
}
