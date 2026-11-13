import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ApiError, userError } from '../../../core/http/api-error';
import { LaunchPathService } from '../../../core/launch-path/launch-path.service';
import { LaunchPathState } from '../../../core/launch-path/launch-path.models';

/**
 * Guided launch path — the single prescriptive route from signup to first
 * commission and Builder. Renders as a compact Home card or the full page.
 */
@Component({
  selector: 'async-launch-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    @if (compact()) {
      @if (loading()) {
        <div class="compact-skeleton" aria-label="Loading launch path"></div>
      } @else if (state(); as path) {
        <a class="compact-card" routerLink="/dashboard/path">
          <span class="compact-icon"><mat-icon>route</mat-icon></span>
          <span class="compact-main">
            <span class="compact-eyebrow">My launch path · {{ path.completed }}/{{ path.total }} complete</span>
            <strong>{{ path.next ? path.next.title : 'Launch path complete' }}</strong>
            <span class="compact-detail">{{ path.next ? path.next.detail : 'You have completed every launch milestone — keep building toward your next rank.' }}</span>
            <span class="compact-track" aria-hidden="true"><span [style.width.%]="path.percent"></span></span>
          </span>
          <span class="compact-action">{{ path.next ? path.next.action : 'View path' }} <mat-icon>arrow_forward</mat-icon></span>
        </a>
      }
    } @else {
      <section class="breadcrumb-wrapper">
        <div class="breadcrumb">
          <a routerLink="/dashboard">Dashboard</a> &gt;
          <span>My launch path</span>
        </div>
      </section>

      <section class="path-page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Guided business launch</p>
            <h1>Your path to first earnings</h1>
            <p class="subtitle">A clear route from account setup to activation, first customer and first commission. The next step is always visible — no guesswork and no chasing.</p>
          </div>
          <a mat-stroked-button routerLink="/dashboard/compensation">
            <mat-icon>payments</mat-icon>
            Earnings hub
          </a>
        </header>

        @if (loading()) {
          <async-page-skeleton layout="dashboard" [rows]="4" label="your launch path" [showHeader]="false" />
        }

        @if (error(); as err) {
          <div class="alert" role="alert">
            <mat-icon>error_outline</mat-icon>
            <p>{{ err }}</p>
            <button mat-stroked-button type="button" (click)="reload()">Retry</button>
          </div>
        }

        @if (state(); as path) {
          <section class="path-hero">
            <div class="hero-copy">
              <span class="hero-eyebrow">Progress</span>
              <div class="hero-value">
                <strong>{{ path.percent }}%</strong>
                <span>{{ path.completed }} of {{ path.total }} milestones</span>
              </div>
              <div class="hero-track" role="progressbar" [attr.aria-valuenow]="path.percent" aria-valuemin="0" aria-valuemax="100" aria-label="Launch path progress">
                <span [style.width.%]="path.percent"></span>
              </div>
              @if (path.next; as next) {
                <div class="hero-next">
                  <span class="next-icon"><mat-icon>{{ next.icon }}</mat-icon></span>
                  <div><span>Next step</span><strong>{{ next.title }}</strong><p>{{ next.detail }}</p></div>
                  <a mat-flat-button color="primary" [routerLink]="next.link">{{ next.action }}</a>
                </div>
              } @else {
                <p class="hero-done"><mat-icon>verified</mat-icon> Launch path complete — your next focus is Builder and consistent weekly activity.</p>
              }
            </div>
            <div class="hero-side">
              <span class="hero-rank-label">Current rank</span>
              <strong>{{ path.rank }}</strong>
              <p>{{ path.name }}, this path is personalised from your live account, pipeline, store and earnings.</p>
              <a mat-stroked-button routerLink="/dashboard/goals">Set a goal</a>
            </div>
          </section>

          <div class="path-layout">
            <ol class="milestones">
              @for (m of path.milestones; track m.key; let i = $index) {
                <li class="milestone" [class.milestone--done]="m.done" [class.milestone--current]="m.current">
                  <span class="milestone-icon">
                    <mat-icon>{{ m.done ? 'check' : m.icon }}</mat-icon>
                  </span>
                  <div class="milestone-copy">
                    <span class="milestone-index">Step {{ i + 1 }}</span>
                    <strong>{{ m.title }}</strong>
                    <p>{{ m.detail }}</p>
                    @if (!m.done) {
                      <a mat-stroked-button [routerLink]="m.link">{{ m.action }} <mat-icon>arrow_forward</mat-icon></a>
                    }
                  </div>
                  <span class="milestone-state">{{ m.done ? 'Done' : m.current ? 'Next' : 'Upcoming' }}</span>
                </li>
              }
            </ol>

            <aside class="path-aside">
              <section class="aside-card">
                <div class="aside-head"><span class="aside-icon"><mat-icon>lightbulb</mat-icon></span><h2>Why this path</h2></div>
                <ul class="reasons">
                  <li><strong>Activation</strong> unlocks commissions, allocation and the partner toolkit.</li>
                  <li><strong>First customer</strong> proves the product engine with real revenue.</li>
                  <li><strong>First commission</strong> confirms your payout path end to end.</li>
                  <li><strong>Builder</strong> opens Level 2 team commissions.</li>
                </ul>
              </section>
              <section class="aside-card aside-card--accent">
                <div class="aside-head"><span class="aside-icon"><mat-icon>support_agent</mat-icon></span><h2>Need help?</h2></div>
                <p class="aside-copy">Your mentor and Ora can help with the current step. Every action is prepared for your approval before anything happens.</p>
                <a mat-stroked-button routerLink="/dashboard/ora">Ask Ora</a>
                <a mat-button routerLink="/dashboard/team/handoffs">Mentor tasks</a>
              </section>
            </aside>
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .path-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .page-head > a mat-icon { margin-right: 6px; }

    .compact-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; text-decoration: none; color: inherit; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); transition: border-color 160ms ease, transform 160ms ease; }
    .compact-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .compact-icon { flex: none; width: 44px; height: 44px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .compact-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .compact-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .compact-eyebrow { color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .compact-main strong { font-size: 1rem; font-weight: 600; }
    .compact-detail { color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .compact-track { height: 4px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; margin-top: 6px; }
    .compact-track span { display: block; height: 100%; border-radius: inherit; background: var(--ms-primary); }
    .compact-action { flex: none; display: inline-flex; align-items: center; gap: 4px; color: var(--ms-primary-strong); font-size: 0.8125rem; font-weight: 600; }
    .compact-action mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .compact-skeleton { height: 92px; border-radius: var(--ms-radius-lg); background: var(--ms-canvas); }

    .path-hero { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.7fr); gap: 24px; padding: 24px; border-radius: var(--ms-radius-2xl); background: linear-gradient(125deg, #121024 0%, #24204b 58%, #3f4bb8 100%); color: #fff; box-shadow: var(--ms-shadow-md); }
    .hero-eyebrow, .hero-rank-label { color: rgba(255,255,255,0.64); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .hero-value { display: flex; align-items: baseline; gap: 12px; margin: 8px 0 12px; flex-wrap: wrap; }
    .hero-value strong { font-family: var(--ms-font-display); font-size: clamp(2.5rem, 5vw, 3.5rem); line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .hero-value span { color: rgba(255,255,255,0.7); font-size: 0.875rem; }
    .hero-track { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.16); overflow: hidden; }
    .hero-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #818cf8, #4ade80); transition: width 320ms ease; }
    .hero-next { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
    .next-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: rgba(255,255,255,0.14); }
    .next-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .hero-next > div { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 1px; }
    .hero-next > div > span { color: rgba(255,255,255,0.6); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .hero-next strong { font-size: 0.9375rem; }
    .hero-next p { margin: 0; color: rgba(255,255,255,0.7); font-size: 0.8125rem; line-height: 1.5; }
    .hero-done { display: flex; align-items: center; gap: 8px; margin: 16px 0 0; color: #bbf7d0; font-size: 0.875rem; }
    .hero-side { border-left: 1px solid rgba(255,255,255,0.14); padding-left: 24px; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
    .hero-side strong { font-family: var(--ms-font-display); font-size: 1.75rem; }
    .hero-side p { margin: 0; color: rgba(255,255,255,0.68); font-size: 0.8125rem; line-height: 1.55; }
    .hero-side a { align-self: flex-start; margin-top: 4px; }

    .path-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.75fr); gap: 24px; align-items: start; }
    .milestones { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .milestone { display: flex; align-items: flex-start; gap: 16px; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .milestone--current { border-color: var(--ms-primary); box-shadow: var(--ms-shadow-sm); }
    .milestone--done { opacity: 0.82; }
    .milestone-icon { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .milestone--done .milestone-icon { background: var(--ms-success-soft); color: var(--ms-success); }
    .milestone--current .milestone-icon { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .milestone-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .milestone-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .milestone-index { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .milestone-copy strong { font-size: 0.9375rem; font-weight: 600; }
    .milestone-copy p { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.55; }
    .milestone-copy a { align-self: flex-start; margin-top: 6px; min-height: 36px; }
    .milestone-copy a mat-icon { font-size: 16px; width: 16px; height: 16px; margin-left: 4px; }
    .milestone-state { flex: none; color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .milestone--done .milestone-state { color: var(--ms-success); }
    .milestone--current .milestone-state { color: var(--ms-primary-strong); }

    .path-aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 96px; }
    .aside-card { padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); display: flex; flex-direction: column; gap: 12px; }
    .aside-card--accent { background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-surface)); border-color: var(--ms-primary); }
    .aside-head { display: flex; align-items: center; gap: 10px; }
    .aside-head h2 { margin: 0; font-size: 0.9375rem; }
    .aside-icon { width: 32px; height: 32px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .aside-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .reasons { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .reasons strong { color: var(--ms-text); }
    .aside-copy { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.6; }
    .aside-card a { min-height: 40px; }

    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }

    @media (max-width: 950px) {
      .path-hero, .path-layout { grid-template-columns: minmax(0, 1fr); }
      .hero-side { border-left: 0; border-top: 1px solid rgba(255,255,255,0.14); padding-left: 0; padding-top: 16px; }
      .path-aside { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .compact-card { align-items: flex-start; flex-wrap: wrap; padding: 16px; }
      .compact-action { margin-left: 60px; }
      .path-aside { grid-template-columns: minmax(0, 1fr); }
      .milestone { padding: 12px; }
      .milestone-state { display: none; }
    }
  `],
})
export class LaunchPathComponent implements OnInit {
  private readonly path = inject(LaunchPathService);
  private readonly destroyRef = inject(DestroyRef);

  readonly compact = input(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly state = signal<LaunchPathState | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.path.load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.state.set(state);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}
