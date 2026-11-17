import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-index-faq',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section" aria-labelledby="faq-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Straight answers</p>
          <h2 class="mkt-h2" id="faq-title">The questions people ask before joining.</h2>
          <p class="mkt-sub">
            The short version. The full FAQ goes deeper.
          </p>
        </div>

        <div class="mkt-faq">
          <details open>
            <summary>What does it cost to start?</summary>
            <p>
              Creating an account is free. Activation is a <strong>₦38,000</strong> product
              purchase — the MarketSpase Signature Clothing Set, shipped to you. There is no
              separate joining fee. Resale stock is optional.
            </p>
          </details>
          <details>
            <summary>Do I have to chase or call people?</summary>
            <p>
              No. MarketSpase runs central advertising and routes the interest through fair
              allocation. Ora drafts the follow-ups; you approve what sends. No cold-call scripts.
            </p>
          </details>
          <details>
            <summary>Is this a pyramid scheme?</summary>
            <p>
              No. The plan pays for product activity, not for recruiting alone. Costs are stated
              upfront and every earning path is tied to a real product or customer.
            </p>
          </details>
          <details>
            <summary>What do I actually do every day?</summary>
            <p>
              You check Ora&rsquo;s plan, approve or edit the next actions, have the human
              conversations that matter, keep up with training and fulfil store orders.
            </p>
          </details>
        </div>

        <div class="mkt-cta" style="margin-top: 2.4rem;">
          <p class="mkt-eyebrow">Your move</p>
          <h2 id="final-cta-title">Your online business. Without the chase.</h2>
          <p>
            Create your free account, meet Ora and see your first plan. No cold calls.
            No chasing friends. No scripts.
          </p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
            <a mat-stroked-button routerLink="/ora" (click)="scrollToTop()">Meet Ora first</a>
          </div>
          <p class="mkt-fine">
            Free to join. Activation is a real product purchase.<br />
            <a
              class="whatsapp-link"
              href="https://wa.me/2348080386208?text=Hello%20MarketSpase%2C%20I%20would%20like%20to%20speak%20with%20a%20human."
              target="_blank"
              rel="noopener"
              title="Chat with MarketSpase on WhatsApp"
            >
              <mat-icon aria-hidden="true">chat</mat-icon>
              chat with a human on WhatsApp
            </a>.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .whatsapp-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      min-height: 44px;
      color: #fff;
      font-weight: 750;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
    }
    .whatsapp-link mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FaqComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
