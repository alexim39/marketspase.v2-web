import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';

@Component({
  selector: 'async-footer',
  imports: [MatIconModule, RouterModule, BrandLogoComponent],
  template: `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a routerLink="/" class="brand" aria-label="MarketSpase home">
            <async-brand-logo variant="full-white" height="30px" alt="" />
          </a>
          <p>
            The online business opportunity without the chase. Real products, fair allocation
            and Ora, your AI business partner.
          </p>
          <a class="footer-cta" routerLink="/partner/signup">
            Start your online business <mat-icon aria-hidden="true">arrow_forward</mat-icon>
          </a>
        </div>

        <nav class="footer-col" aria-label="Platform">
          <h2>Platform</h2>
          <a routerLink="/">Home</a>
          <a routerLink="/how-it-works">How it works</a>
          <a routerLink="/ora">Meet Ora</a>
          <a routerLink="/partner/signup">Start your business</a>
          <a routerLink="/partner/signin">Partner sign in</a>
        </nav>

        <nav class="footer-col" aria-label="Company">
          <h2>Company</h2>
          <a routerLink="/about">About MarketSpase</a>
          <a routerLink="/faq">FAQ</a>
          <a href="https://whatsapp.com/channel/0029Vb77xA51NCrKysUMO11D" target="_blank" rel="noopener">WhatsApp channel</a>
          <a href="mailto:contacts@marketspase.com">Email support</a>
        </nav>

        <nav class="footer-col" aria-label="Legal">
          <h2>Legal</h2>
          <a href="https://marketspase.com/legal/terms" target="_blank" rel="noopener">Terms of Service</a>
          <a href="https://marketspase.com/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>
          <a routerLink="/faq">Common questions</a>
        </nav>
      </div>

      <div class="footer-base">
        <span>&copy; {{ currentYear }} MarketSpase. All rights reserved.</span>
        <span>Built by Async Groups.</span>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .site-footer {
      margin-top: 4em;
      background: var(--ms-ink);
      color: var(--ms-ink-text);
    }

    .footer-inner {
      width: min(1180px, calc(100% - 2.5em));
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 0.65fr));
      gap: 2em;
      padding: 3em 0 2.4em;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }

    .footer-brand p {
      max-width: 26em;
      margin: 1em 0;
      color: color-mix(in srgb, var(--ms-ink-text) 62%, transparent);
      font-size: 0.86em;
      line-height: 1.55;
    }

    .footer-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      color: var(--ms-ink-icon);
      font-size: 0.86em;
      font-weight: 750;
      text-decoration: none;
    }

    .footer-cta:hover { color: var(--ms-ink-text); }

    .footer-cta mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .footer-col {
      display: flex;
      flex-direction: column;
      gap: 0.45em;
      font-size: 0.84em;
    }

    .footer-col h2 {
      margin: 0 0 0.2em;
      color: color-mix(in srgb, var(--ms-ink-text) 50%, transparent);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .footer-col a {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      color: color-mix(in srgb, var(--ms-ink-text) 78%, transparent);
      text-decoration: none;
    }

    .footer-col a:hover { color: var(--ms-ink-text); }

    .footer-base {
      width: min(1180px, calc(100% - 2.5em));
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      gap: 1em;
      flex-wrap: wrap;
      padding: 1.1em 0 1.4em;
      border-top: 1px solid color-mix(in srgb, var(--ms-ink-text) 12%, transparent);
      color: color-mix(in srgb, var(--ms-ink-text) 58%, transparent);
      font-size: 0.72em;
    }

    @media (max-width: 900px) {
      .footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .footer-brand { grid-column: 1 / -1; }
    }

    @media (max-width: 600px) {
      .footer-inner { grid-template-columns: 1fr; padding: 2.2em 0 1.8em; }
    }
  `],
})
export class FooterComponent {
  protected readonly currentYear = new Date().getFullYear();
}
