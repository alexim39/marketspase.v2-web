import { Injectable, computed, signal } from '@angular/core';

const LITE_KEY = 'ms_lite_mode';
const SLOW_AFTER_MS = 8000;
const SLOW_NOTICE_MUTE_KEY = 'ms_slow_notice_muted_until';
const SLOW_NOTICE_MUTE_MS = 10 * 60 * 1000;

interface NetworkInformationLike {
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
}

/**
 * One connectivity view for every MarketSpase app.
 *
 * Tracks real request activity (not a fake timer), supports a user-selected
 * lite mode, and exposes whether a cached response was served so the banner
 * can tell the user when they are looking at saved data.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  readonly online = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly slow = signal(false);
  readonly activeRequests = signal(0);
  readonly completedRequests = signal(0);
  readonly cacheUsed = signal(false);
  readonly liteMode = signal(this.readLite());

  readonly effectiveType = signal(this.readEffectiveType());
  readonly progressPercent = computed(() => {
    const done = this.completedRequests();
    const active = this.activeRequests();
    const total = done + active;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  });
  readonly totalRequests = computed(() => this.completedRequests() + this.activeRequests());

  private slowTimer: number | null = null;
  private resetTimer: number | null = null;
  private slowMutedUntil = this.readSlowMute();

  constructor() {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['lite'] = this.liteMode() ? 'true' : 'false';
    }
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.online.set(true);
      this.slow.set(false);
      this.clearSlowTimer();
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
      this.slow.set(false);
      this.clearSlowTimer();
    });
    const connection = this.connection();
    connection?.addEventListener?.('change', () => {
      this.effectiveType.set(this.readEffectiveType());
      if (this.isWeakType() && !this.slowNoticeMuted()) this.slow.set(true);
    });
  }

  startRequest(): void {
    if (this.activeRequests() === 0) {
      this.completedRequests.set(0);
      this.cacheUsed.set(false);
      this.clearResetTimer();
      this.scheduleSlow();
    }
    this.activeRequests.update((n) => n + 1);
  }

  endRequest(): void {
    this.activeRequests.update((n) => Math.max(0, n - 1));
    this.completedRequests.update((n) => n + 1);
    if (this.activeRequests() === 0) {
      this.clearSlowTimer();
      this.resetTimer = window.setTimeout(() => {
        this.slow.set(false);
        this.completedRequests.set(0);
      }, 2200);
    }
  }

  noteCacheHit(): void {
    this.cacheUsed.set(true);
  }

  dismissCacheNotice(): void {
    this.cacheUsed.set(false);
  }

  dismissSlow(): void {
    this.slow.set(false);
    this.clearSlowTimer();
    this.muteSlowNotice();
  }

  enableLiteMode(): void {
    this.setLite(true);
    this.slow.set(false);
    this.clearSlowTimer();
    this.muteSlowNotice();
  }

  disableLiteMode(): void {
    this.setLite(false);
  }

  retry(): void {
    window.location.reload();
  }

  private setLite(value: boolean): void {
    this.liteMode.set(value);
    try {
      localStorage.setItem(LITE_KEY, value ? '1' : '0');
    } catch { /* private mode */ }
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['lite'] = value ? 'true' : 'false';
    }
  }

  private readLite(): boolean {
    try {
      return localStorage.getItem(LITE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private readEffectiveType(): string {
    return String(this.connection()?.effectiveType ?? '');
  }

  private connection(): NetworkInformationLike | null {
    if (typeof navigator === 'undefined') return null;
    return (navigator as Navigator & { connection?: NetworkInformationLike }).connection ?? null;
  }

  private isWeakType(): boolean {
    return ['slow-2g', '2g', '3g'].includes(this.effectiveType());
  }

  private scheduleSlow(): void {
    this.clearSlowTimer();
    if (this.slowNoticeMuted()) return;
    if (this.isWeakType()) {
      this.slow.set(true);
      return;
    }
    this.slowTimer = window.setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
  }

  private slowNoticeMuted(): boolean {
    return Date.now() < this.slowMutedUntil;
  }

  private muteSlowNotice(): void {
    this.slowMutedUntil = Date.now() + SLOW_NOTICE_MUTE_MS;
    try {
      sessionStorage.setItem(SLOW_NOTICE_MUTE_KEY, String(this.slowMutedUntil));
    } catch { /* private mode */ }
  }

  private readSlowMute(): number {
    try {
      return Number(sessionStorage.getItem(SLOW_NOTICE_MUTE_KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  private clearSlowTimer(): void {
    if (this.slowTimer !== null) {
      window.clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
  }

  private clearResetTimer(): void {
    if (this.resetTimer !== null) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}
