import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ThemeTogglerService, type DpThemeMode } from '../../../../_common/services/theme-toggler.service';

interface ThemeOption {
  value: DpThemeMode;
  label: string;
  description: string;
  icon: string;
}

/**
 * Appearance settings — the standard Light / Dark / System choice.
 * Lives under Settings instead of a toolbar shortcut; one preference for
 * every MarketSpase dashboard screen.
 */
@Component({
  selector: 'async-appearance-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/settings/profiles">Settings</a> &gt;
        <span>Appearance</span>
      </div>
    </section>

    <section class="appearance-page">
      <header class="page-head">
        <div>
          <h2>Appearance</h2>
          <p class="subtitle">Choose how MarketSpase looks on this device. This setting applies across the dashboard.</p>
        </div>
      </header>

      <div class="theme-grid" role="radiogroup" aria-label="Color theme">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="theme-card"
            [class.selected]="mode() === option.value"
            role="radio"
            [attr.aria-checked]="mode() === option.value"
            (click)="setMode(option.value)"
          >
            <span class="theme-icon"><mat-icon>{{ option.icon }}</mat-icon></span>
            <span class="theme-copy">
              <strong>{{ option.label }}</strong>
              <span class="muted">{{ option.description }}</span>
            </span>
            @if (mode() === option.value) {
              <span class="selected-pill">Selected</span>
            }
          </button>
        }
      </div>

      <div class="dp-card note">
        <mat-icon>info</mat-icon>
        <p>
          <strong>System</strong> follows your operating system setting and updates automatically.
          Your choice is saved on this device only.
        </p>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .appearance-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; max-width: 900px; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .theme-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75em; }
    .theme-card { position: relative; display: flex; align-items: flex-start; gap: 0.8em; text-align: left; padding: 1.1em; border-radius: 14px; border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); cursor: pointer; font: inherit; transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease; }
    .theme-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .theme-card.selected { border-color: var(--ms-primary); box-shadow: 0 0 0 2px var(--ms-primary-soft); }
    .theme-card:focus-visible { outline: 2px solid var(--ms-primary); outline-offset: 2px; }
    .theme-icon { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .theme-copy { display: flex; flex-direction: column; gap: 0.2em; min-width: 0; }
    .theme-copy strong { font-size: 1em; }
    .muted { color: var(--ms-text-muted); font-size: 0.84em; line-height: 1.45; }
    .selected-pill { position: absolute; top: 0.8em; right: 0.8em; border-radius: 999px; padding: 2px 8px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .note { display: flex; gap: 0.7em; align-items: flex-start; padding: 1em; }
    .note mat-icon { color: var(--ms-primary-strong); flex: none; }
    .note p { margin: 0; font-size: 0.88em; line-height: 1.5; color: var(--ms-text-muted); }
    .note strong { color: var(--ms-text); }
    button { min-height: 44px; }
  `],
})
export class AppearanceSettingsComponent {
  private readonly themes = inject(ThemeTogglerService);

  protected readonly mode = computed(() => this.themes.mode());
  protected readonly options: ThemeOption[] = [
    { value: 'light', label: 'Light', description: 'Bright surfaces and dark text for daytime work.', icon: 'light_mode' },
    { value: 'dark', label: 'Dark', description: 'Low-glare surfaces for night and low-light use.', icon: 'dark_mode' },
    { value: 'system', label: 'System', description: 'Match this device’s appearance setting automatically.', icon: 'brightness_auto' },
  ];

  protected setMode(mode: DpThemeMode): void {
    this.themes.setMode(mode);
  }
}
