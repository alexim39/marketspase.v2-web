import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-index-faq',
  imports: [MatButtonModule, RouterModule],
  template: `
    <section class="mkt-section" aria-labelledby="faq-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Straight answers</p>
          <h2 class="mkt-h2" id="faq-title">Real answers. Just the things you&rsquo;re actually wondering.</h2>
          <p class="mkt-sub">
            Everything you need to know about the online business, the money and Ora.
            If a question is not here, the full FAQ goes deeper.
          </p>
        </div>

        <div class="mkt-faq">
          <details open>
            <summary>What kind of online business is this?</summary>
            <p>
              MarketSpase is a product-backed online business. You activate with a real product,
              earn from product sales and qualification, and use Ora to plan the day and prepare
              the work.
            </p>
          </details>
          <details>
            <summary>Do I have to chase or call people?</summary>
            <p>
              No. MarketSpase runs central advertising and routes the interest through fair
              allocation. Ora drafts the follow-ups and you approve what sends. No cold, warm or
              hot call scripts.
            </p>
          </details>
          <details>
            <summary>Do I need experience or a big following?</summary>
            <p>
              No. Ora gives you a daily plan, the academy teaches the basics and the community
              has your back. You need consistency and a willingness to learn — that&rsquo;s it.
            </p>
          </details>
          <details>
            <summary>What do I actually do every day?</summary>
            <p>
              You approve Ora&rsquo;s plan, have real conversations with interested people, support
              your team and track progress. The platform handles the chasing and the busywork.
            </p>
          </details>
          <details>
            <summary>How do I make money?</summary>
            <p>
              Through product sales, team and placement commissions, the Activation Mentor Bonus
              and store or retail orders. Every earning path is visible in your wallet.
            </p>
          </details>
          <details>
            <summary>What does it cost to start?</summary>
            <p>
              Creating your account is free. When you activate, you buy the MarketSpase starter
              product at the price shown before you pay. There is no separate joining fee, and
              you will see the full breakdown in your wallet.
            </p>
          </details>
          <details>
            <summary>Does Ora act without me?</summary>
            <p>
              No. Ora can prepare campaigns, follow-ups and team messages, but you approve, edit
              or skip before anything runs. You stay in control.
            </p>
          </details>
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 1.8rem;">
          <a mat-button routerLink="/faq" (click)="scrollToTop()">Read the full FAQ →</a>
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FaqComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
