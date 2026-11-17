import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * The differentiator: Ora is not a generic chatbot. It reads the partner's
 * real business state, plans the day and acts only after approval.
 */
@Component({
  selector: 'async-index-ora-showcase',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section mkt-section--ink" aria-labelledby="ora-showcase-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Meet Ora · Your AI business partner</p>
          <h2 class="mkt-h2" id="ora-showcase-title">You are the CEO. Ora is the operator.</h2>
          <p class="mkt-sub">
            Most opportunities leave you alone with a script and a group chat. Ora reads your rank,
            pipeline, campaigns and team, then prepares the work. You approve what happens next.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--3">
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>today</mat-icon></span>
            <h3>Ora plans</h3>
            <p>Get a short daily plan built from your real pipeline, campaigns and team.</p>
          </article>
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>edit_note</mat-icon></span>
            <h3>Ora prepares</h3>
            <p>Follow-ups, campaign drafts and team check-ins arrive ready for review.</p>
          </article>
          <article class="mkt-card mkt-card--ink">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>verified_user</mat-icon></span>
            <h3>You approve</h3>
            <p>Yes, edit or skip. Nothing runs without your approval.</p>
          </article>
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          <a mat-stroked-button routerLink="/ora" (click)="scrollToTop()">Meet Ora</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class OraShowcaseComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
