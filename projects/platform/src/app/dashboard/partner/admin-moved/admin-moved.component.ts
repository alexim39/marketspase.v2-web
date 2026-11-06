import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'async-admin-moved',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="moved-page">
      <div class="moved-card">
        <span class="moved-icon"><mat-icon>admin_panel_settings</mat-icon></span>
        <p class="eyebrow">Platform administration</p>
        <h1>The admin console has moved.</h1>
        <p>
          Admin work now lives in the standalone MarketSpase Admin app. Partner and member tools
          remain here in the partner platform.
        </p>
        <div class="actions">
          <a mat-flat-button color="primary" [href]="adminUrl" target="_blank" rel="noopener">
            <mat-icon>open_in_new</mat-icon> Open admin console
          </a>
          <a mat-stroked-button routerLink="/dashboard">Back to dashboard</a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .moved-page { display: grid; place-items: center; min-height: 70vh; padding: 2em 1em; }
    .moved-card { width: min(100%, 620px); padding: 2.4em; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); background: var(--ms-surface); box-shadow: var(--ms-shadow-md); text-align: center; }
    .moved-icon { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 1em; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .moved-icon mat-icon { width: 30px; height: 30px; font-size: 30px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { margin: 0.3em 0 0.4em; font-size: clamp(1.8rem, 4vw, 2.8rem); letter-spacing: -0.04em; }
    p:not(.eyebrow) { max-width: 38em; margin: 0 auto; color: var(--ms-text-muted); line-height: 1.55; }
    .actions { display: flex; justify-content: center; gap: 0.5em; flex-wrap: wrap; margin-top: 1.4em; }
    .actions a { min-height: 44px; }
  `],
})
export class AdminMovedComponent {
  protected readonly adminUrl = environment.adminUrl;
}
