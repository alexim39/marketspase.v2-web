import { Injectable, signal } from '@angular/core';

export type MsTheme = 'light' | 'dark';
export type MsThemeMode = MsTheme | 'system';

/**
 * One theme preference for every MarketSpase app.
 *
 * Standard appearance model: Light / Dark / System. The effective theme is
 * mirrored to `document.documentElement[data-theme]`; the chosen mode persists
 * in localStorage. Existing `selectedTheme` values keep working.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'selectedTheme';
  private systemListenerBound = false;

  /** The effective theme applied to the document. */
  readonly theme = signal<MsTheme>(this.resolve(this.getMode()));
  /** The user's preference: light, dark or follow the OS. */
  readonly mode = signal<MsThemeMode>(this.getMode());

  /** Backwards-compatible explicit setter. */
  setTheme(theme: MsTheme): void {
    this.setMode(theme);
  }

  setMode(mode: MsThemeMode): void {
    const safe: MsThemeMode = mode === 'light' || mode === 'dark' ? mode : 'system';
    try {
      if (safe === 'system') localStorage.removeItem(this.THEME_KEY);
      else localStorage.setItem(this.THEME_KEY, safe);
    } catch {
      // Private mode: apply for this session only.
    }
    const effective = this.resolve(safe);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', effective);
    }
    this.mode.set(safe);
    this.theme.set(effective);
  }

  getMode(): MsThemeMode {
    try {
      const stored = localStorage.getItem(this.THEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Fall through to system.
    }
    return 'system';
  }

  /** Effective theme for a mode; System follows prefers-color-scheme. */
  private resolve(mode: MsThemeMode): MsTheme {
    if (mode === 'light' || mode === 'dark') return mode;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }

  /** Apply the stored/OS theme once at boot and follow OS changes. */
  init(): void {
    this.setMode(this.getMode());
    this.bindSystemListener();
  }

  toggle(): void {
    this.setMode(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private bindSystemListener(): void {
    if (this.systemListenerBound) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (this.mode() !== 'system') return;
      const effective = this.resolve('system');
      document.documentElement.setAttribute('data-theme', effective);
      this.theme.set(effective);
    };
    if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    else if (typeof query.addListener === 'function') query.addListener(onChange);
    this.systemListenerBound = true;
  }
}
