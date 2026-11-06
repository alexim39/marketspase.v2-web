import { Injectable, signal } from '@angular/core';

export type DpTheme = 'dark' | 'light';

/**
 * MarketSpase theme state. Persists to localStorage and mirrors to
 * `document.documentElement[data-theme]` (see styles.scss).
 * Additive to the legacy get/set API — nothing else changes.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeTogglerService {

  private readonly THEME_KEY = 'selectedTheme';

  readonly theme = signal<DpTheme>(this.getTheme());

  setTheme(theme: 'dark' | 'light') {
    localStorage.setItem(this.THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.theme.set(theme);
  }

  /** Stored preference wins; fresh devices and private mode start dark. */
  getTheme(): 'dark' | 'light' {
    const stored = localStorage.getItem(this.THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  }

  /** Apply the stored theme (call once at boot to avoid a flash). */
  init(): void {
    this.setTheme(this.getTheme());
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }
}
