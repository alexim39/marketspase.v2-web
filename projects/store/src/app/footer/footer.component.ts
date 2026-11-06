import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'async-footer',
  imports: [RouterModule, BrandLogoComponent],
  template: `
    <footer class="ms-footer">
      <div class="footer-inner ms-store-page">
        <div class="footer-brand">
          <a routerLink="/" class="brand" aria-label="MarketSpase Store home">
            <async-brand-logo class="brand-logo" variant="full-white" height="34px" alt="" />
            <span class="brand-store" aria-hidden="true">Store</span>
          </a>
          <p>Independent partner stores. Real people. Secure checkout.</p>
          <a class="partner-cta" [href]="platformUrl + '/partner/signup'">Open your own store →</a>
        </div>

        <div class="footer-col">
          <h3>Shop</h3>
          <a routerLink="/stores">Find a store</a>
          <a routerLink="/support">Support</a>
        </div>

        <div class="footer-col">
          <h3>Partners</h3>
          <a [href]="platformUrl + '/partner/signin'">Partner sign in</a>
          <a [href]="platformUrl + '/partner/signup'">Become a partner</a>
          <a [href]="platformUrl">Platform</a>
        </div>

        <div class="footer-col">
          <h3>Legal</h3>
          <a routerLink="/legal/terms">Terms</a>
          <a routerLink="/legal/privacy">Privacy</a>
          <a routerLink="/legal/cookies">Cookies</a>
        </div>
      </div>

      <div class="footer-base ms-store-page">
        <span>© {{ year }} MarketSpase Store. All rights reserved.</span>
        <span>Built for independent partners.</span>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .ms-footer {
      margin-top: 4em;
      background: var(--ms-ink);
      color: var(--ms-ink-text);
    }

    .footer-inner {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 0.7fr));
      gap: 2em;
      padding: 3em 0 2.4em;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.55em;
      color: var(--ms-ink-text);
      text-decoration: none;
    }

    .brand-logo {
      display: block;
      width: auto;
      height: 34px;
    }

    .brand-store {
      padding-left: 0.6em;
      border-left: 1px solid rgba(244, 243, 255, 0.24);
      color: rgba(244, 243, 255, 0.58);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      line-height: 1;
      text-transform: uppercase;
    }

    .footer-brand p {
      max-width: 28em;
      margin: 1em 0;
      color: rgba(244, 243, 255, 0.62);
      font-size: 0.86em;
      line-height: 1.55;
    }

    .partner-cta {
      color: var(--ms-ink-icon);
      font-size: 0.86em;
      font-weight: 750;
      text-decoration: none;
    }

    .partner-cta:hover { color: #fff; }

    .footer-col {
      display: flex;
      flex-direction: column;
      gap: 0.45em;
      font-size: 0.84em;
    }

    .footer-col h3 {
      margin: 0 0 0.2em;
      color: rgba(244, 243, 255, 0.5);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .footer-col a {
      color: rgba(244, 243, 255, 0.78);
      text-decoration: none;
    }

    .footer-col a:hover { color: #fff; }

    .footer-base {
      display: flex;
      justify-content: space-between;
      gap: 1em;
      flex-wrap: wrap;
      padding: 1.1em 0 1.4em;
      border-top: 1px solid rgba(244, 243, 255, 0.12);
      color: rgba(244, 243, 255, 0.45);
      font-size: 0.72em;
    }

    @media (max-width: 900px) {
      .footer-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .footer-brand { grid-column: 1 / -1; }
    }

    @media (max-width: 600px) {
      .footer-inner { grid-template-columns: 1fr; padding: 2.2em 0 1.8em; }
      .brand-logo { height: 30px; }
    }
  `],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');
}
