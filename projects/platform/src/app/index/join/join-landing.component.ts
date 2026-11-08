import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const CAMPAIGN_KEY = 'ms_campaign';
const REF_KEY = 'ms_ref';
const LEAD_KEY = 'ms_lead';

/**
 * Public acquisition landing — the destination for campaign tracking links
 * (`/join?campaign=gc_...`). Persists the code so signup can attribute the
 * account even if the visitor navigates before creating it.
 */
@Component({
  selector: 'async-join-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="mkt-hero">
      <div class="mkt-hero-inner">
        <div class="mkt-hero-copy">
          <p class="mkt-eyebrow">Your online business opportunity · Without the chase</p>
          <h1>Start a real online business <span class="mkt-accent">without chasing anyone.</span></h1>
          <p class="mkt-lede">
            MarketSpase gives you a product-backed online business, brings the interest and puts
            <strong>Ora</strong>, your AI business partner, in your corner. Ora plans and prepares;
            you approve the next move.
          </p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" [routerLink]="['/partner/signup']" [queryParams]="signupParams()">
              Start your online business
            </a>
            <a mat-stroked-button routerLink="/how-it-works">See how it works</a>
          </div>
          @if (referrer()) {
            <p class="referral-chip" role="status">
              <mat-icon aria-hidden="true">handshake</mat-icon>
              Referred by &#64;{{ referrer() }}
            </p>
          }
          @if (campaign()) {
            <p class="campaign-chip" role="status">
              <mat-icon aria-hidden="true">campaign</mat-icon>
              Campaign: {{ campaign() }}
            </p>
          }
          <p class="mkt-fine">
            Activation buys a real product; commissions follow product sales and qualification.
          </p>
        </div>

        <aside class="join-card" aria-label="How MarketSpase works">
          <p class="join-card-eyebrow">Your first four moves</p>
          <ol class="join-steps">
            <li>
              <span class="join-step-num">1</span>
              <div><strong>Create your free account</strong><span>Verify your email, meet Ora and get your first plan.</span></div>
            </li>
            <li>
              <span class="join-step-num">2</span>
              <div><strong>Activate your online business</strong><span>A real MarketSpase clothing set, shipped to you. Complete KYC.</span></div>
            </li>
            <li>
              <span class="join-step-num">3</span>
              <div><strong>Let the platform bring the interest</strong><span>Central ads and fair allocation. You don&rsquo;t chase.</span></div>
            </li>
            <li>
              <span class="join-step-num">4</span>
              <div><strong>Approve the next move</strong><span>Ora prepares follow-ups and campaigns. You approve and track your wallet.</span></div>
            </li>
          </ol>
          <a class="join-more" routerLink="/how-it-works">
            Read the full journey <mat-icon aria-hidden="true">arrow_forward</mat-icon>
          </a>
        </aside>
      </div>
    </div>

    <section class="mkt-section" aria-labelledby="join-why-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Why start here</p>
          <h2 class="mkt-h2" id="join-why-title">A real online business. Without the old hustle.</h2>
          <p class="mkt-sub">
            No cold calls. No chasing friends. No guesswork. Just a product-backed business
            and a coach who prepares the work.
          </p>
        </div>
        <div class="mkt-grid mkt-grid--4">
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>do_not_disturb_on</mat-icon></span>
            <h3>No chasing</h3>
            <p>MarketSpase runs central ads and routes the interest through fair allocation.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>auto_awesome</mat-icon></span>
            <h3>Ora prepares, you approve</h3>
            <p>Daily plans, follow-ups and campaign drafts — you stay in control.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>verified</mat-icon></span>
            <h3>A real product business</h3>
            <p>Product-backed, not a course or a joining fee. Real margin, transparent wallet.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>groups</mat-icon></span>
            <h3>Support built in</h3>
            <p>Ora, your team and the community are in your corner from day one.</p>
          </article>
        </div>

        <div class="mkt-cta" style="margin-top: 2rem;">
          <p class="mkt-eyebrow">Start free</p>
          <h2>Your online business starts here.</h2>
          <p>Create your account, look around and ask Ora your first question. You can activate when you are ready.</p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" [routerLink]="['/partner/signup']" [queryParams]="signupParams()">Start your online business</a>
            <a mat-stroked-button routerLink="/ora">Meet Ora first</a>
          </div>
          <p class="mkt-fine">Free to join. Activation is a real product purchase.</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .campaign-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 14px 0 0;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: var(--ms-ink-icon);
      font-size: 0.78rem;
      font-weight: 700;
    }
    .campaign-chip mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .referral-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 14px 0 0;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(87, 220, 160, 0.16);
      border: 1px solid rgba(87, 220, 160, 0.38);
      color: #c7ffe3;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .referral-chip mat-icon { width: 16px; height: 16px; font-size: 16px; }

    .join-card {
      width: min(440px, 100%);
      margin: 0 auto;
      padding: 1.35em;
      border-radius: var(--ms-radius-xl);
      background: #ffffff;
      color: #12131a;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
    }
    .join-card-eyebrow {
      margin: 0 0 0.9em;
      color: #676c7e;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .join-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9em; }
    .join-steps li { display: flex; align-items: flex-start; gap: 0.7em; }
    .join-step-num {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: none;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 800;
    }
    .join-steps strong { display: block; font-size: 0.94rem; line-height: 1.25; }
    .join-steps span { display: block; margin-top: 2px; color: #676c7e; font-size: 0.83rem; line-height: 1.45; }
    .join-more {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      min-height: 44px;
      margin-top: 0.8em;
      color: #4c5bd4;
      font-size: 0.83rem;
      font-weight: 750;
      text-decoration: none;
    }
    .join-more mat-icon { width: 17px; height: 17px; font-size: 17px; }
  `],
})
export class JoinLandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly campaign = signal<string | null>(null);
  protected readonly referrer = signal<string | null>(null);
  protected readonly lead = signal<string | null>(null);

  ngOnInit(): void {
    const fromQuery = String(this.route.snapshot.queryParamMap.get('campaign') ?? '').trim();
    let fromStore = '';
    try { fromStore = localStorage.getItem(CAMPAIGN_KEY) ?? ''; } catch { /* private mode */ }
    const code = fromQuery || fromStore;
    if (code) {
      this.campaign.set(code);
      try { localStorage.setItem(CAMPAIGN_KEY, code); } catch { /* ignore */ }
    }

    const refQuery = String(this.route.snapshot.queryParamMap.get('ref') ?? '').trim();
    const refStore = readKey(REF_KEY);
    const ref = refQuery || refStore;
    if (ref) {
      const clean = ref.replace(/^@/, '');
      this.referrer.set(clean);
      try { localStorage.setItem(REF_KEY, clean); } catch { /* ignore */ }
    }

    const leadQuery = String(this.route.snapshot.queryParamMap.get('lead') ?? '').trim();
    const leadStore = readKey(LEAD_KEY);
    const lead = leadQuery || leadStore;
    if (/^[a-fA-F0-9]{24}$/.test(lead)) {
      this.lead.set(lead);
      try { localStorage.setItem(LEAD_KEY, lead); } catch { /* ignore */ }
    }
  }

  protected signupParams(): Record<string, string> {
    return {
      ...(this.campaign() ? { campaign: this.campaign()! } : {}),
      ...(this.referrer() ? { ref: this.referrer()! } : {}),
      ...(this.lead() ? { lead: this.lead()! } : {}),
    };
  }
}

function readKey(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
