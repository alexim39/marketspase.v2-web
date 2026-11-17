import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-index-pathway',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section mkt-section--soft" aria-labelledby="pathway-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">How it works</p>
          <h2 class="mkt-h2" id="pathway-title">From a free account to your first product sale.</h2>
          <p class="mkt-sub">
            No chasing, no cold calls, no guessing. Three steps, then Ora keeps the work moving.
          </p>
        </div>

        <ol class="mkt-steps">
          <li class="mkt-step">
            <span class="mkt-step-num">1</span>
            <h3>Start free. Meet Ora.</h3>
            <p>Create your account, verify your email and get your first plan. No calls.</p>
          </li>
          <li class="mkt-step mkt-step--accent">
            <span class="mkt-step-num">2</span>
            <h3>Activate with a real product</h3>
            <p>Complete KYC and order the ₦38,000 MarketSpase starter product. It ships to you.</p>
          </li>
          <li class="mkt-step">
            <span class="mkt-step-num">3</span>
            <h3>Approve the next move. Earn.</h3>
            <p>Follow Ora&rsquo;s daily plan, serve interested customers and earn from product activity.</p>
          </li>
        </ol>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          <a mat-stroked-button routerLink="/how-it-works" (click)="scrollToTop()">See the full journey</a>
        </div>
        <p class="mkt-fine" style="text-align: center; max-width: 44em; margin-left: auto; margin-right: auto;">
          Activation is a product purchase, not a recruitment fee. You earn from product sales and qualification.
        </p>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PathwayComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
