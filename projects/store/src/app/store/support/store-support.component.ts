import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'async-store-support',
  imports: [RouterModule],
  template: `
    <section class="support-page ms-store-page">
      <p class="eyebrow">MarketSpase Store</p>
      <h1>How can we help?</h1>
      <p class="subtitle">Questions about an order, a partner store or opening your own shop?</p>

      <div class="support-grid">
        <article>
          <h2>I bought from a partner</h2>
          <p>Contact the partner first from the store page or your order confirmation. They fulfil and deliver the order.</p>
          <a routerLink="/stores">Find your store</a>
        </article>
        <article>
          <h2>I'm a partner</h2>
          <p>Manage stock, listings and store orders from the platform. Your public store is separate from your dashboard.</p>
          <a [href]="platformUrl + '/partner/signin'">Open partner platform</a>
        </article>
        <article>
          <h2>I want to open a store</h2>
          <p>Activate a MarketSpase partner account, buy resale stock and publish your own storefront.</p>
          <a [href]="platformUrl + '/partner/signup'">Become a partner</a>
        </article>
        <article>
          <h2>Something is wrong</h2>
          <p>Report a payment, delivery or product issue. Include your order number if you have one.</p>
          <a [href]="platformUrl + '/dashboard/support/ticket'">Contact support</a>
        </article>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .support-page { padding: 3em 0 4em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
    h1 { margin: 0.2em 0 0.3em; font-size: clamp(2rem, 4.5vw, 3rem); letter-spacing: -0.04em; }
    .subtitle { max-width: 38em; margin: 0; color: var(--ms-text-muted); line-height: 1.55; }
    .support-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 0.8em; margin-top: 2em; }
    article { padding: 1.1em 1.2em; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    h2 { margin: 0 0 0.35em; font-size: 1.02em; }
    article p { margin: 0 0 0.7em; color: var(--ms-text-muted); font-size: 0.88em; line-height: 1.5; }
    article a { color: var(--ms-primary-strong); font-weight: 750; text-decoration: none; }
  `],
})
export class StoreSupportComponent {
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');
}
