import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-index-why-we-exist',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section mkt-section--ink" aria-labelledby="mission-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <span class="mkt-icon-tile" style="margin: 0 auto 1em;" aria-hidden="true">
            <mat-icon>auto_awesome</mat-icon>
          </span>
          <p class="mkt-eyebrow">Why we exist</p>
          <h2 class="mkt-h2" id="mission-title">We built the online business opportunity we wished existed.</h2>
          <p class="mkt-sub">
            Most network marketing left young people with scripts, group chats and pressure.
            MarketSpase gives them a real product business, a platform that brings the interest
            and an AI business partner that prepares the work.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--3">
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>do_not_disturb_on</mat-icon></span>
            <h3>No chasing</h3>
            <p>MarketSpase runs the ads and routes the interest. You never have to hunt strangers.</p>
          </article>
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>phone_disabled</mat-icon></span>
            <h3>No cold calls</h3>
            <p>Ora prepares the conversation. You approve what sends.</p>
          </article>
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>inventory_2</mat-icon></span>
            <h3>Real business</h3>
            <p>A real product, product margin and a transparent wallet — not a course or a joining fee.</p>
          </article>
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          <a mat-stroked-button routerLink="/about" (click)="scrollToTop()">Read our story</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class WhyWeExistComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
