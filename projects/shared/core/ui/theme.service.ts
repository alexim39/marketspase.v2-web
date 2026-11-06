import { Injectable, signal } from '@angular/core';

export type MsTheme = 'light' | 'dark';

/**
 * One theme preference for every MarketSpase app.
 * Persists to localStorage and mirrors to `document.documentElement[data-theme]`.
 * Existing `selectedTheme` values are preserved; fresh devices follow the OS.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'selectedTheme';
  readonly theme = signal<MsTheme>(this.getTheme());

  setTheme(theme: MsTheme): void {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch {
      // Private mode: apply for this session only.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    this.theme.set(theme);
  }

  getTheme(): MsTheme {
    try {
      const stored = localStorage.getItem(this.THEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Fall through to the OS preference.
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }

  /** Apply the stored/OS theme once at boot to avoid a flash. */
  init(): void {
    this.setTheme(this.getTheme());
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }
}
