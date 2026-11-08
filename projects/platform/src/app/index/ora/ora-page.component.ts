import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

interface OraDemo {
  prompt: string;
  answer: string[];
  actions: string[];
}

const DEMOS: OraDemo[] = [
  {
    prompt: 'What should I do in my online business today?',
    answer: [
      'Morning. Based on your pipeline and campaign activity, here are your three moves:',
      'Follow up with 2 interested prospects who opened your last message. Review 4 new page leads before 2pm. Check in with one teammate who has not activated yet.',
    ],
    actions: ['Approve plan', 'Edit plan'],
  },
  {
    prompt: 'What is the status of my online business?',
    answer: [
      'You are active and in good shape. One campaign is live, 4 leads are waiting and ₦18,400 in commissions is pending release.',
      'The thing to watch: 3 follow-ups are overdue. I can prepare them for your review.',
    ],
    actions: ['Approve follow-ups', 'View commissions'],
  },
  {
    prompt: 'Help me set up a campaign to get more leads.',
    answer: [
      'I can draft it. Based on your best-performing audience, I would suggest a 14-day campaign across two target states with a ₦20,000 budget.',
      'I will show you the full brief before anything is charged. You approve the final version.',
    ],
    actions: ['Approve draft', 'Change budget'],
  },
  {
    prompt: 'Who on my team needs support?',
    answer: [
      'Three people are worth a check-in: two new partners still finishing activation, and one Builder whose team activity dropped this week.',
      'I can prepare short, personal messages for each. You can edit every message before it sends.',
    ],
    actions: ['Approve messages', 'Open my team'],
  },
];

/**
 * Public "Meet Ora" page. The demo is deliberately client-side and clearly
 * labelled as an example — the real Ora conversation lives in the app.
 */
@Component({
  selector: 'async-ora-page-public',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="mkt-page-hero">
      <div class="mkt-page-hero-inner">
        <nav class="mkt-breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <mat-icon aria-hidden="true" style="font-size: 14px; width: 14px; height: 14px;">chevron_right</mat-icon>
          <span>Meet Ora</span>
        </nav>
        <p class="mkt-eyebrow">Ora · Your AI business partner</p>
        <h1>The AI partner that does the work you&rsquo;d rather not do.</h1>
        <p class="mkt-lede">
          You want to build an online business, not become a call centre. Ora plans your day,
          drafts the follow-ups, prepares your campaigns and keeps your team visible. You approve
          the next move.
        </p>
        <div class="mkt-actions">
          <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
          <a mat-stroked-button routerLink="/how-it-works">See how it all fits</a>
        </div>
        <p class="mkt-fine">Ora suggests and prepares actions. You approve before anything runs.</p>
      </div>
    </div>

    <section class="mkt-section" aria-labelledby="ora-demo-title">
      <div class="mkt-section-inner mkt-split">
        <div>
          <p class="mkt-eyebrow">A real conversation, roughly</p>
          <h2 class="mkt-h2" id="ora-demo-title">Ask the questions you actually have.</h2>
          <p class="mkt-lede">
            Tap a question to see how Ora turns it into an action you can approve. In the app,
            the answer is built from your live business data — rank, leads, campaigns and team.
          </p>
          <div class="mkt-prompt-list" role="group" aria-label="Example questions for Ora">
            @for (demo of demos; track demo.prompt; let i = $index) {
              <button
                type="button"
                class="mkt-chip"
                [class.mkt-chip--brand]="selected() === i"
                [attr.aria-pressed]="selected() === i"
                (click)="selected.set(i)"
              >{{ demo.prompt }}</button>
            }
          </div>
          <p class="mkt-fine" style="margin-top: 1.2rem;">
            Example conversation. Your real Ora uses your live progress, so every answer is
            personal to your business.
          </p>
        </div>

        <div class="mkt-ora-window">
          <div class="mkt-ora-head">
            <span class="mkt-ora-avatar" aria-hidden="true">O</span>
            <div class="mkt-ora-head-text">
              <strong>Ora</strong>
              <span class="mkt-ora-status">Online · your business partner</span>
            </div>
          </div>
          <div class="mkt-ora-body">
            <div class="mkt-msg mkt-msg--user">
              <p>{{ current().prompt }}</p>
            </div>
            <div class="mkt-msg mkt-msg--ora">
              @for (line of current().answer; track $index) {
                <p>{{ line }}</p>
              }
              <div class="mkt-msg-actions">
                @for (action of current().actions; track $index) {
                  <span>{{ action }}</span>
                }
              </div>
            </div>
          </div>
          <div class="mkt-ora-input">
            <span>Ask Ora anything…</span>
            <span class="mkt-ora-send" aria-hidden="true"><mat-icon>arrow_upward</mat-icon></span>
          </div>
        </div>
      </div>
    </section>

    <section class="mkt-section mkt-section--band" aria-labelledby="ora-can-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">What Ora takes off your plate</p>
          <h2 class="mkt-h2" id="ora-can-title">No blank page. No scripts. No guessing.</h2>
          <p class="mkt-sub">Ora turns your business data into the next action, so you can spend your time on people, not admin.</p>
        </div>
        <div class="mkt-grid mkt-grid--3">
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>today</mat-icon></span>
            <h3>Plan your day</h3>
            <p>Turn your pipeline, goals and team into a short, prioritised list of moves for today.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>monitoring</mat-icon></span>
            <h3>Review your business</h3>
            <p>Get a plain-language status on campaigns, prospects, commissions and the gaps worth closing.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>campaign</mat-icon></span>
            <h3>Prepare campaigns</h3>
            <p>Ask for more leads and Ora prepares the audience, budget and brief for your approval.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>forum</mat-icon></span>
            <h3>Prep follow-ups</h3>
            <p>Interested prospects and overdue conversations surface before they go cold — with messages ready to edit.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--rose" aria-hidden="true"><mat-icon>groups</mat-icon></span>
            <h3>Spot team gaps</h3>
            <p>See who needs support, who is close to activating and where your next leader is growing.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>payments</mat-icon></span>
            <h3>Explain your numbers</h3>
            <p>Understand pending commissions, released earnings and what activity created them.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="ora-trust-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head mkt-section-head--left">
          <p class="mkt-eyebrow">Trust by default</p>
          <h2 class="mkt-h2" id="ora-trust-title">Powerful, and always in your hands.</h2>
          <p class="mkt-sub">AI should make you faster while you stay in control. Here is how Ora works with you.</p>
        </div>
        <div class="mkt-grid mkt-grid--4">
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>verified_user</mat-icon></span>
            <h3>You approve actions</h3>
            <p>Ora can prepare a campaign, message or follow-up plan. Nothing goes live without your confirmation.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>check_circle</mat-icon></span>
            <h3>Real numbers only</h3>
            <p>Ora works with what is actually happening in your account, so every plan reflects your real business.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>shield</mat-icon></span>
            <h3>Your contacts stay yours</h3>
            <p>Ora helps you follow up while keeping your contacts and private data yours.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>tips_and_updates</mat-icon></span>
            <h3>The why behind the move</h3>
            <p>Recommendations are tied to your actual business state, so you learn the reasoning as you go.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="ora-cta-title">
      <div class="mkt-section-inner">
        <div class="mkt-cta">
          <p class="mkt-eyebrow">Your AI partner is waiting</p>
          <h2 id="ora-cta-title">Meet Ora inside your online business.</h2>
          <p>Create a free account, verify your email and ask your first question. Ora will prepare the next move.</p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
            <a mat-stroked-button routerLink="/faq">Read the FAQ</a>
          </div>
          <p class="mkt-fine">Free to join. Activation is a real product purchase.</p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class OraPublicPageComponent {
  protected readonly demos = DEMOS;
  protected readonly selected = signal(0);
  protected readonly current = computed(() => this.demos[this.selected()]);
}
