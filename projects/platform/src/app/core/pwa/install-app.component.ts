import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PwaInstallService } from './pwa-install.service';

/**
 * Install entry for desktop browsers and mobile home-screen installs.
 * There is intentionally no APK link: this app ships as an installable PWA.
 */
@Component({
  selector: 'async-install-app',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="install-card">
      <span class="install-icon" aria-hidden="true"><mat-icon>install_mobile</mat-icon></span>
      <div class="install-copy">
        <p class="eyebrow">MarketSpase app</p>
        <h2>{{ install.installed() ? 'Installed on this device' : 'Install MarketSpase' }}</h2>

        @if (install.installed()) {
          <p>You are using the installed app. It opens in its own window and keeps your workspace one tap away.</p>
        } @else if (install.canInstall()) {
          <p>Add MarketSpase to your desktop or home screen. It opens like a native app and keeps you signed in to your workspace.</p>
        } @else if (install.isIos()) {
          <p>On iPhone or iPad, open this page in Safari, tap the <strong>Share</strong> button, then choose <strong>Add to Home Screen</strong>.</p>
        } @else if (install.isAndroid()) {
          <p>In Chrome, open the <strong>⋮</strong> menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If you opened this inside another app, reopen it in Chrome first.</p>
        } @else {
          <p>Use the install icon in your browser's address bar, or open the browser menu and choose <strong>Install MarketSpase</strong>. Chrome and Edge support this on desktop.</p>
        }

        <p class="fine">MarketSpase installs directly as a web app. No APK download is required.</p>
      </div>

      <div class="install-actions">
        @if (install.canInstall()) {
          <button mat-flat-button color="primary" type="button" (click)="installApp()" [disabled]="busy()">
            <mat-icon>download_for_offline</mat-icon>
            {{ busy() ? 'Opening…' : 'Install app' }}
          </button>
        } @else if (install.installed()) {
          <span class="installed-chip"><mat-icon>check_circle</mat-icon> Installed</span>
        } @else {
          <a mat-stroked-button href="mailto:contacts@marketspase.com?subject=MarketSpase%20app%20installation">Need help?</a>
        }
      </div>
    </section>
  `,
  styles: [`
    .install-card {
      display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;
      padding: 16px 18px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg);
      background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface) 66%);
      box-shadow: var(--ms-shadow-sm);
    }
    .install-icon {
      width: 44px; height: 44px; flex: none; display: grid; place-items: center;
      border-radius: 13px; background: var(--ms-surface); color: var(--ms-primary-strong);
    }
    .install-copy { flex: 1; min-width: 240px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: .68rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
    h2 { margin: 3px 0 5px; font-size: 1.08rem; }
    p { margin: 0 0 4px; color: var(--ms-text-muted); font-size: .84rem; line-height: 1.55; }
    p strong { color: var(--ms-text); }
    .fine { margin-top: 6px; font-size: .74rem; }
    .install-actions { display: flex; align-items: center; gap: 8px; flex: none; }
    .install-actions button, .install-actions a { min-height: 42px; }
    .install-actions mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 3px; }
    .installed-chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: .78rem; font-weight: 800; }
    .installed-chip mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @media (max-width: 640px) {
      .install-actions { width: 100%; }
      .install-actions button, .install-actions a { width: 100%; justify-content: center; }
    }
  `],
})
export class InstallAppComponent {
  protected readonly install = inject(PwaInstallService);
  protected readonly busy = signal(false);

  protected async installApp(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.install.promptInstall();
    } finally {
      this.busy.set(false);
    }
  }
}
