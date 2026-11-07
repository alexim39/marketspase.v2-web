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
      <div class="mkt-section-inner mkt-split">
        <div>
          <p class="mkt-eyebrow">Meet Ora · Your AI business partner</p>
          <h2 class="mkt-h2" id="ora-showcase-title">You are the CEO. Ora is the operator.</h2>
          <p class="mkt-lede">
            Most online business opportunities leave you alone with a script and a group chat.
            Ora knows your rank, pipeline, campaigns and team — then plans the day, drafts the
            follow-ups and prepares the work. You approve what happens next.
          </p>

          <ul class="mkt-value-list">
            <li>
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span><strong>Ora plans.</strong> Ask what to do today and get a short, personal plan for your online business.</span>
            </li>
            <li>
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span><strong>Ora prepares.</strong> Campaigns, follow-ups and team check-ins arrive drafted and ready for you.</span>
            </li>
            <li>
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span><strong>You approve.</strong> Yes, edit or skip. Nothing runs without your say-so.</span>
            </li>
            <li>
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span><strong>You learn as you go.</strong> Every recommendation ties back to your real business, so you get sharper.</span>
            </li>
          </ul>

          <div class="mkt-actions" style="margin-top: 1.6rem;">
            <a mat-flat-button color="primary" routerLink="/ora" (click)="scrollToTop()">Meet Ora</a>
            <a mat-stroked-button routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          </div>
        </div>

        <div class="mkt-hero-visual">
          <div class="mkt-hero-orbit" aria-hidden="true"></div>
          <div class="mkt-ora-window mkt-ora-window--hero" role="img" aria-label="Example of Ora reviewing a partner's online business and preparing a campaign">
            <div class="mkt-ora-head">
              <span class="mkt-ora-avatar" aria-hidden="true">O</span>
              <div class="mkt-ora-head-text">
                <strong>Ora</strong>
                <span class="mkt-ora-status">Online · your business partner</span>
              </div>
            </div>
            <div class="mkt-ora-body">
              <div class="mkt-msg mkt-msg--user">
                <p>How&rsquo;s my online business looking?</p>
              </div>
              <div class="mkt-msg mkt-msg--ora">
                <p>Solid week. 2 new teammates, 4 leads waiting and &#8358;18,400 in pending commissions. Your gap: 3 follow-ups are overdue.</p>
                <div class="mkt-msg-actions">
                  <span>Approve plan</span>
                  <span>Edit plan</span>
                </div>
              </div>
              <div class="mkt-msg mkt-msg--user">
                <p>Help me set up a campaign for more leads.</p>
              </div>
              <div class="mkt-msg mkt-msg--ora">
                <p>On it. I&rsquo;ll draft the audience, budget and a 14-day flight from your current pipeline. Want to review it?</p>
                <div class="mkt-msg-actions">
                  <span>Approve draft</span>
                  <span>Change budget</span>
                </div>
              </div>
            </div>
            <div class="mkt-ora-input">
              <span>Ask Ora anything…</span>
              <span class="mkt-ora-send" aria-hidden="true"><mat-icon>arrow_upward</mat-icon></span>
            </div>
          </div>
          <p class="mkt-ora-footnote">
            <mat-icon aria-hidden="true">verified_user</mat-icon>
            You approve every action. Ora never runs without your yes.
          </p>
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
