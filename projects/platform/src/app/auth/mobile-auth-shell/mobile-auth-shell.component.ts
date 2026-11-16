import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';

/**
 * Focused mobile auth frame. The public marketing chrome is hidden on auth
 * routes at mobile sizes, so this owns the brand, safe areas and card rhythm.
 */
@Component({
  selector: 'async-mobile-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogoComponent, MatIconModule, RouterModule],
  template: `
    <section class="ms-mobile-auth">
      <header class="auth-brand">
        <a routerLink="/" aria-label="MarketSpase home">
          <async-brand-logo
            [variant]="theme() === 'light' ? 'full-dark' : 'full-white'"
            height="30px"
            alt=""
          />
        </a>
      </header>

      <div class="auth-card">
        @if (showBack()) {
          <a class="back" [routerLink]="backLink()">← {{ backLabel() }}</a>
        }
        @if (eyebrow()) {
          <p class="eyebrow">{{ eyebrow() }}</p>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="sub">{{ subtitle() }}</p>
        }
        <ng-content />
      </div>

      <ng-content select="[authFooter]" />

      <p class="secure">
        <mat-icon aria-hidden="true">shield</mat-icon>
        Secure account access · Encrypted in transit
      </p>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-auth {
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: calc(20px + var(--ms-safe-top)) var(--ms-mobile-gutter)
        calc(24px + var(--ms-safe-bottom));
      background:
        radial-gradient(700px 380px at 50% -10%, rgba(102, 126, 234, 0.18), transparent 70%),
        var(--ms-canvas);
      box-sizing: border-box;
    }

    .auth-brand {
      display: flex;
      justify-content: center;
      padding: 4px 0 2px;
    }

    .auth-brand a {
      display: inline-flex;
      text-decoration: none;
    }

    .auth-card {
      width: min(460px, 100%);
      display: flex;
      flex-direction: column;
      padding: 22px 18px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-2xl);
      background: var(--ms-surface);
      box-shadow: var(--ms-shadow-md);
      box-sizing: border-box;
      text-align: center;
    }

    .back {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--ms-primary-strong);
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
    }

    .eyebrow {
      margin: 6px 0 0;
      color: var(--ms-primary-strong);
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1 {
      margin: 6px 0 4px;
      color: var(--ms-text);
      font-family: var(--ms-font-display);
      font-size: clamp(1.7rem, 8vw, 2.15rem);
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    .sub {
      margin: 0 0 14px;
      color: var(--ms-text-muted);
      font-size: 0.86rem;
      line-height: 1.55;
    }

    .secure {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin: 0;
      color: var(--ms-text-muted);
      font-size: 0.68rem;
      text-align: center;
    }

    .secure mat-icon {
      color: var(--ms-primary-strong);
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    :host ::ng-deep .mat-mdc-form-field {
      width: 100%;
    }

    :host ::ng-deep .mat-mdc-form-field .mat-mdc-input-element {
      font-size: 1rem;
    }

    @media (min-width: 600px) {
      .ms-mobile-auth {
        padding-top: 40px;
      }
      .auth-card {
        padding: 28px 26px;
      }
    }
  `],
})
export class MobileAuthShellComponent {
  private readonly themes = inject(ThemeService);

  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly showBack = input(true);
  readonly backLink = input('/');
  readonly backLabel = input('Back to home');

  protected readonly theme = this.themes.theme;
}
