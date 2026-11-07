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
          <p class="mkt-eyebrow">How your online business works</p>
          <h2 class="mkt-h2" id="pathway-title">From &ldquo;I want to earn online&rdquo; to a business that knows its next move.</h2>
          <p class="mkt-sub">
            No chasing, no cold calls, no guessing. Here is the whole journey from a free
            account to a business that knows what it is doing today.
          </p>
        </div>

        <ol class="mkt-steps">
          <li class="mkt-step">
            <span class="mkt-step-num">1</span>
            <h3>Start free. Meet Ora.</h3>
            <p>Create your account, verify your email and get your first plan. No pressure, no calls.</p>
          </li>
          <li class="mkt-step mkt-step--accent">
            <span class="mkt-step-num">2</span>
            <h3>Activate your online business</h3>
            <p>Get the MarketSpase starter product — a real product, shipped to you. Complete KYC and join the allocation queue.</p>
          </li>
          <li class="mkt-step">
            <span class="mkt-step-num">3</span>
            <h3>Let the platform bring the interest</h3>
            <p>MarketSpase runs central ads and allocates activated partners fairly to funded campaigns. You don&rsquo;t chase.</p>
          </li>
          <li class="mkt-step">
            <span class="mkt-step-num">4</span>
            <h3>Approve the next move. Grow.</h3>
            <p>Ora prepares follow-ups, campaigns and team check-ins. You approve, track your wallet and build.</p>
          </li>
        </ol>

        <div style="margin-top: 2.2rem; text-align: center;">
          <p class="mkt-eyebrow" style="margin-bottom: 0.7em;">Your rank path</p>
          <ul class="mkt-ladder" aria-label="Partner rank path">
            <li>Partner</li>
            <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
            <li>Builder</li>
            <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
            <li>Leader</li>
            <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
            <li class="is-current">Ambassador</li>
          </ul>
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          <a mat-stroked-button routerLink="/how-it-works" (click)="scrollToTop()">See the full journey</a>
        </div>
        <p class="mkt-fine" style="text-align: center; max-width: 44em; margin-left: auto; margin-right: auto;">
          Activation is a product purchase, not a recruitment fee — and your dashboard shows every next step.
          You earn from product sales and qualification.
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
