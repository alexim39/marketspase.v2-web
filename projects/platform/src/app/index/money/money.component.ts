import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/** Plain-language earnings and cost transparency for the reduced landing page. */
@Component({
  selector: 'async-index-money',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section mkt-section--soft" aria-labelledby="money-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">The money</p>
          <h2 class="mkt-h2" id="money-title">You earn from product activity — not from recruiting alone.</h2>
          <p class="mkt-sub">
            Every earning path is tied to a real product, a real sale or a real customer.
            The costs are shown before you pay anything.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--2">
          <article class="mkt-card">
            <h3>Four ways to earn</h3>
            <ul class="mkt-value-list">
              <li>
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <span><strong>Resale margin.</strong> Buy at partner price, sell at retail and keep the difference.</span>
              </li>
              <li>
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <span><strong>Store sales.</strong> Retail proceeds minus the 2% store service fee and payment-processing fee.</span>
              </li>
              <li>
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <span><strong>Activation and product commissions.</strong> Paid down the levels your rank unlocks.</span>
              </li>
              <li>
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <span><strong>Mentor bonus.</strong> A fixed ₦1,200 when you mentor a new partner through activation.</span>
              </li>
            </ul>
          </article>

          <article class="mkt-card mkt-card--brand">
            <h3>What it costs</h3>
            <p><strong>Free</strong> to create an account, meet Ora and explore.</p>
            <p><strong>₦38,000</strong> activation product — the MarketSpase Signature Clothing Set, shipped to you.</p>
            <p>Resale stock is optional. Store sales carry a 2% service fee plus payment processing.</p>
            <p class="mkt-fine">
              Sign-up alone, recruiting alone, training alone, campaign spend and deposits do not pay.
              Results depend on effort, skill, consistency and market conditions.
            </p>
            <a class="mkt-inline-link" routerLink="/how-it-works">See the full cost breakdown <mat-icon aria-hidden="true">arrow_forward</mat-icon></a>
          </article>
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
          <a mat-stroked-button routerLink="/faq">Read the full FAQ</a>
        </div>
      </div>
    </section>
  `,
})
export class MoneyComponent {}
