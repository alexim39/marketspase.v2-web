import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const CAMPAIGN_KEY = 'ms_campaign';

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
    <section class="join-page">
      <div class="join-hero">
        <div class="hero-copy">
          <p class="eyebrow">MarketSpase · Partner business</p>
          <h1>Own a real product business. Let the platform bring the growth.</h1>
          <p class="lede">
            MarketSpase runs the advertising, captures interest and allocates activated partners fairly.
            You activate with a real clothing product, build your team and earn from product margin — not recruitment fees.
          </p>
          <div class="hero-actions">
            <a mat-flat-button color="primary" class="cta" [routerLink]="['/partner/signup']" [queryParams]="signupParams()">
              Create your account
            </a>
            <a mat-stroked-button routerLink="/partner/signin">I already have an account</a>
          </div>
          @if (campaign()) {
            <p class="campaign-chip" role="status">
              <mat-icon aria-hidden="true">campaign</mat-icon>
              Campaign: {{ campaign() }}
            </p>
          }
          <p class="fine">
            No guaranteed placement or income. Activation buys a real product; commissions follow product margin and qualification.
          </p>
        </div>

        <div class="hero-card">
          <p class="card-eyebrow">How it works</p>
          <ol class="steps">
            <li>
              <span class="step-num">1</span>
              <div><strong>Create your free account</strong><span>Verify your email and complete your profile.</span></div>
            </li>
            <li>
              <span class="step-num">2</span>
              <div><strong>Activate with the starter product</strong><span>A real MarketSpase clothing set, shipped to you.</span></div>
            </li>
            <li>
              <span class="step-num">3</span>
              <div><strong>Enter the allocation queue</strong><span>Fair weighting places you with an eligible campaign owner.</span></div>
            </li>
            <li>
              <span class="step-num">4</span>
              <div><strong>Earn and build</strong><span>Product commissions, mentor bonus and team growth.</span></div>
            </li>
          </ol>
        </div>
      </div>

      <div class="value-grid">
        <article>
          <mat-icon>verified</mat-icon>
          <strong>A real product</strong>
          <p>The activation purchase buys a standalone clothing set — not a joining fee.</p>
        </article>
        <article>
          <mat-icon>hub</mat-icon>
          <strong>Central acquisition</strong>
          <p>MarketSpase advertises and captures prospects; partners are allocated fairly.</p>
        </article>
        <article>
          <mat-icon>balance</mat-icon>
          <strong>Explainable allocation</strong>
          <p>Wait time, capped campaign contribution, fit and capacity decide placement.</p>
        </article>
        <article>
          <mat-icon>payments</mat-icon>
          <strong>Margin-based rewards</strong>
          <p>Commissions and mentor bonuses are funded by product gross margin, never campaign spend.</p>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .join-page { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; display: flex; flex-direction: column; gap: 22px; }
    .join-hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.9fr); gap: 22px; align-items: center; }
    .eyebrow { margin: 0 0 8px; color: var(--ms-primary-strong); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { margin: 0 0 12px; font-size: clamp(2rem, 4.4vw, 3.2rem); line-height: 1.06; letter-spacing: -0.035em; }
    .lede { margin: 0; max-width: 46em; color: var(--ms-text-muted); font-size: 1.02rem; line-height: 1.6; }
    .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .hero-actions a { min-height: 48px; text-decoration: none; }
    .cta { font-weight: 800; }
    .campaign-chip { display: inline-flex; align-items: center; gap: 6px; margin: 14px 0 0; padding: 5px 11px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.8em; font-weight: 700; }
    .campaign-chip mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .fine { margin: 14px 0 0; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; max-width: 44em; }
    .hero-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); padding: 20px; box-shadow: var(--ms-shadow-md); }
    .card-eyebrow { margin: 0 0 12px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ms-text-muted); }
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .steps li { display: flex; gap: 12px; align-items: flex-start; }
    .step-num { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; font-weight: 800; font-size: 0.85em; }
    .steps strong { display: block; font-size: 0.98em; }
    .steps span { display: block; color: var(--ms-text-muted); font-size: 0.86em; line-height: 1.45; margin-top: 2px; }
    .value-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .value-grid article { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 6px; }
    .value-grid mat-icon { color: var(--ms-primary-strong); }
    .value-grid strong { font-size: 0.98em; }
    .value-grid p { margin: 0; color: var(--ms-text-muted); font-size: 0.86em; line-height: 1.5; }
    @media (max-width: 860px) {
      .join-hero { grid-template-columns: 1fr; }
      .join-page { padding-top: 20px; }
    }
  `],
})
export class JoinLandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly campaign = signal<string | null>(null);

  ngOnInit(): void {
    const fromQuery = String(this.route.snapshot.queryParamMap.get('campaign') ?? '').trim();
    let fromStore = '';
    try { fromStore = localStorage.getItem(CAMPAIGN_KEY) ?? ''; } catch { /* private mode */ }
    const code = fromQuery || fromStore;
    if (code) {
      this.campaign.set(code);
      try { localStorage.setItem(CAMPAIGN_KEY, code); } catch { /* ignore */ }
    }
  }

  protected signupParams(): Record<string, string> {
    const code = this.campaign();
    return code ? { campaign: code } : {};
  }
}
