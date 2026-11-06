import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { ProgressionService } from '../../core/progression/progression.service';
import { APP_RANKS, AppRank, Journey, TRAINING_TRACK, appRankIndex } from '../../core/progression/progression.models';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';

/**
 * @title My progress — the four-rank MarketSpase model.
 *
 * Partner → Builder → Leader → Ambassador. IPO/QSG/SMO training is recorded
 * automatically from the course certificate; there is no upline approval step.
 * Rank is assigned by the AI Admin after a qualification review; this page
 * shows the criteria and the supporting account/training signals.
 */
@Component({
  selector: 'async-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>My progress</span>
      </div>
    </section>

    <section class="progress-page">
      <div class="page-head">
        <div>
          <h2>My progress</h2>
          <p class="subtitle">Partner → Builder → Leader → Ambassador. IPO, QSG and SMO training is recorded automatically; rank is assigned by the AI Admin after review.</p>
        </div>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/dashboard/training">Academy</a>
          <a mat-button routerLink="/dashboard/goals">Goals</a>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      <div class="dp-card rank-hero">
        <div>
          <span class="eyebrow">Current rank</span>
          <h3>{{ currentRank() }}</h3>
          <p class="muted">{{ currentDefinition().tagline }} · {{ currentDefinition().commission }} · Assigned by the AI Admin after review.</p>
        </div>
        <div class="rank-position">
          <span>Rank</span>
          <strong>{{ rankIndex() + 1 }} of {{ ranks.length }}</strong>
        </div>
      </div>

      <div class="rank-roadmap" aria-label="MarketSpase rank ladder">
        @for (r of ranks; track r.rank; let i = $index) {
          <div
            class="dp-card rank-card"
            [class.current]="i === rankIndex()"
            [class.done]="i < rankIndex()"
            [attr.aria-current]="i === rankIndex() ? 'step' : null"
          >
            <span class="rank-index">{{ i + 1 }}</span>
            <div class="rank-copy">
              <strong>{{ r.label }}</strong>
              <span class="muted">{{ r.tagline }}</span>
              <span class="rank-meta">{{ r.commission }}</span>
            </div>
            @if (i < rankIndex()) {
              <mat-icon class="rank-state">check_circle</mat-icon>
            } @else if (i === rankIndex()) {
              <span class="pill">Current</span>
            }
          </div>
        }
      </div>

      <div class="content-grid">
        <div class="dp-card">
          <h3>Training record</h3>
          <p class="muted">These three certificates are recorded and confirmed by the system. No upline approval is needed.</p>
          @if (journey()) {
            <ul class="training-list">
              @for (t of training; track t.key) {
                <li>
                  <mat-icon [class.done]="trainingDone(t.key)">
                    {{ trainingDone(t.key) ? 'check_circle' : 'radio_button_unchecked' }}
                  </mat-icon>
                  <div class="training-copy">
                    <strong>{{ t.label }}</strong>
                    <span class="muted">
                      @if (trainingDone(t.key)) {
                        Recorded {{ trainingDate(t.key) | date:'mediumDate' }}
                      } @else {
                        Not completed yet
                      }
                    </span>
                  </div>
                  @if (!trainingDone(t.key)) {
                    <a mat-button [routerLink]="['/dashboard/training/courses', t.courseId]">Open</a>
                  }
                </li>
              }
            </ul>
            <p class="training-count">{{ trainingCount() }} of {{ training.length }} core trainings recorded</p>
          } @else {
            <p class="muted">Loading your training record…</p>
          }
        </div>

        <div class="dp-card">
          <h3>Promotion review · {{ nextRank()?.label ?? 'top rank' }}</h3>
          @if (nextRank(); as next) {
            <p class="muted">Criteria the AI Admin reviews for {{ next.label }}:</p>
            <ul class="criteria">
              @for (criterion of next.criteria; track criterion) {
                <li><mat-icon>chevron_right</mat-icon><span>{{ criterion }}</span></li>
              }
            </ul>
            <p class="muted review-note">Meeting these criteria does not auto-promote you. Rank is assigned after the review.</p>
          } @else {
            <p class="empty">You are at the top rank. Keep leading and developing the next generation.</p>
          }
        </div>
      </div>

      <div class="dp-card signals">
        <h3>Live team signals</h3>
        <div class="signal-grid">
          <span><strong>{{ journey()?.signals?.recruits ?? 0 }}</strong> direct recruits</span>
          <span><strong>{{ journey()?.signals?.activeDownline ?? 0 }}</strong> active downline</span>
        </div>
        <p class="muted">
          These signals support your promotion review alongside retail activity and the training record. They do not
          auto-promote you — the AI Admin assigns each rank after review.
        </p>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .progress-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; }
    .head-actions { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 52em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .rank-hero { padding: 1.2em; display: flex; justify-content: space-between; align-items: center; gap: 1em; flex-wrap: wrap; }
    .rank-hero h3 { margin: 0.2em 0 0.15em; font-size: 1.65rem; }
    .rank-hero p { margin: 0; }
    .rank-position { text-align: right; display: flex; flex-direction: column; gap: 0.1em; }
    .rank-position span { color: var(--ms-text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .rank-position strong { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
    .rank-roadmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.6em; }
    .rank-card { padding: 0.9em; display: flex; gap: 0.75em; align-items: flex-start; border: 1px solid var(--ms-line); opacity: 0.72; }
    .rank-card.current { opacity: 1; border-color: var(--ms-primary); box-shadow: 0 0 0 1px var(--ms-primary); }
    .rank-card.done { opacity: 1; }
    .rank-index { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--ms-surface-3); color: var(--ms-text-muted); font-weight: 700; font-size: 0.8rem; }
    .rank-card.current .rank-index { background: var(--ms-primary); color: #fff; }
    .rank-card.done .rank-index { background: var(--ms-success-soft); color: var(--ms-success); }
    .rank-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1em; }
    .rank-copy strong { font-size: 1em; }
    .rank-meta { font-size: 0.75rem; color: var(--ms-primary-strong); font-weight: 600; }
    .rank-state { color: var(--ms-success); flex: none; }
    .pill { flex: none; border-radius: 999px; padding: 0.2em 0.6em; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 700; }
    .content-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75em; }
    .content-grid .dp-card { padding: 1em; }
    .content-grid h3, .signals h3 { margin: 0 0 0.35em; font-size: 1em; }
    .training-list { list-style: none; margin: 0.7em 0 0.4em; padding: 0; display: flex; flex-direction: column; gap: 0.55em; }
    .training-list li { display: flex; align-items: center; gap: 0.6em; }
    .training-list mat-icon { color: var(--ms-text-muted); flex: none; }
    .training-list mat-icon.done { color: var(--ms-success); }
    .training-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.05em; }
    .training-count { margin: 0.4em 0 0; font-size: 0.8rem; font-weight: 600; color: var(--ms-primary-strong); }
    .criteria { list-style: none; margin: 0.6em 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .criteria li { display: flex; gap: 0.3em; align-items: flex-start; font-size: 0.88em; }
    .criteria mat-icon { flex: none; font-size: 18px; height: 18px; width: 18px; color: var(--ms-primary-strong); margin-top: 1px; }
    .signals { padding: 1em; }
    .signal-grid { display: flex; gap: 1.5em; flex-wrap: wrap; margin: 0.5em 0; }
    .signal-grid span { display: flex; flex-direction: column; gap: 0.1em; color: var(--ms-text-muted); font-size: 0.78rem; }
    .signal-grid strong { color: var(--ms-text); font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .review-note { margin: 0.6em 0 0; font-size: 0.82em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
    @media only screen and (max-width: 600px) {
      .rank-position { text-align: left; }
    }
  `],
})
export class ProgressComponent implements OnInit {
  private readonly progress = inject(ProgressionService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ranks = APP_RANKS;
  protected readonly training = TRAINING_TRACK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);

  protected readonly currentRank = computed<AppRank>(() =>
    (this.auth.currentUser()?.commissionRank as AppRank | undefined) ?? 'Partner',
  );
  protected readonly rankIndex = computed(() => appRankIndex(this.currentRank()));
  protected readonly currentDefinition = computed(() => APP_RANKS[this.rankIndex()] ?? APP_RANKS[0]);
  protected readonly nextRank = computed(() => APP_RANKS[this.rankIndex() + 1] ?? null);

  private readonly milestones = computed(() => {
    const raw = (this.journey()?.milestones ?? {}) as Record<string, {
      done?: boolean; at?: string | null; confirmedAt?: string | null;
    }>;
    return raw;
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.progress
      .mine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.journey.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected trainingDone(key: string): boolean {
    return this.milestones()[key]?.done === true;
  }

  protected trainingDate(key: string): string | null {
    const stamp = this.milestones()[key];
    return stamp?.confirmedAt ?? stamp?.at ?? null;
  }

  protected trainingCount(): number {
    return this.training.filter((t) => this.trainingDone(t.key)).length;
  }
}
