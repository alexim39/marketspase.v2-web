import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
selector: 'async-banner',
imports: [MatButtonModule, MatIconModule, RouterModule],
template: `

<div class="mkt-hero">
  <div class="mkt-hero-inner">
    <div class="mkt-hero-copy">
      <p class="mkt-eyebrow">Online business opportunity · Make money online without the chase</p>
      <h1>Build a real online business <span class="mkt-accent">without chasing anyone.</span></h1>
      <p class="mkt-lede">
        Start for <strong>₦38,000</strong> — no chasing. Ora plans your day; you approve the next move.
      </p>
      <div class="mkt-actions">
        <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
        <a class="mkt-desktop-action" mat-stroked-button routerLink="/how-it-works" (click)="scrollToTop()">See how it works</a>
        <a class="mkt-mobile-action" mat-stroked-button routerLink="/partner/signin" (click)="scrollToTop()">Sign in</a>
      </div>
      <p class="mkt-fine">Create your account free. Activate for ₦38,000 with a real product. No cold calls. No scripts.</p>
      <div class="mkt-hero-proof" aria-label="What you get with MarketSpase">
        <span><mat-icon aria-hidden="true">do_not_disturb_on</mat-icon> No chasing or cold calls</span>
        <span><mat-icon aria-hidden="true">auto_awesome</mat-icon> Ora prepares, you approve</span>
        <span><mat-icon aria-hidden="true">inventory_2</mat-icon> Real product. Real margin.</span>
      </div>
    </div>

    <div class="mkt-hero-visual">
      <div class="mkt-hero-orbit" aria-hidden="true"></div>
      <div class="mkt-ora-window mkt-ora-window--hero" role="img" aria-label="Preview of a conversation with Ora, the MarketSpase AI business partner">
        <div class="mkt-ora-head">
          <span class="mkt-ora-avatar" aria-hidden="true">O</span>
          <div class="mkt-ora-head-text">
            <strong>Ora</strong>
            <span class="mkt-ora-status">Online · knows your business</span>
          </div>
          <span class="mkt-chip">24/7</span>
        </div>

        <div class="mkt-ora-body">
          <div class="mkt-msg mkt-msg--user">
            <p>What should I do in my online business today?</p>
          </div>
          <div class="mkt-msg mkt-msg--ora">
            <strong>Morning! Here&rsquo;s your 3-move plan:</strong>
            <ul>
              <li>Follow up with 2 interested prospects.</li>
              <li>Review the 4 new leads from your campaign.</li>
              <li>Check in with a teammate who hasn&rsquo;t activated yet.</li>
            </ul>
            <div class="mkt-msg-actions">
              <span>Approve plan</span>
              <span>Edit plan</span>
            </div>
          </div>
          <div class="mkt-msg mkt-msg--user">
            <p>Nice. Set up a campaign for more leads.</p>
          </div>
          <div class="mkt-msg mkt-msg--ora">
            <p>On it. I&rsquo;ll draft the audience, budget and brief. You approve before anything goes live.</p>
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
        You are the CEO. Ora is the operator — every action waits for your yes.
      </p>
    </div>
  </div>
</div>

`,
styles: [`
  .mkt-mobile-action { display: none; }

  @media (max-width: 720px) {
    .mkt-desktop-action { display: none; }
    .mkt-mobile-action { display: inline-flex; }
  }
`],
changeDetection: ChangeDetectionStrategy.Eager,
})
export class BannerComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
