import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { JobHealthRow, JobHealthService } from './job-health.service';
import { ApiError } from '../../../core/http/api-error';
import { timeAgo } from '../../../_common/date-util';

/**
 * @title Automation — sweep health at a glance.
 *
 * The money-moving background jobs (lead allocation, flight expiry, pool
 * work-or-return) record every firing. A sweep with no recent success
 * shows STALE so a stalled scheduler gets noticed, not discovered.
 * OnPush + signals.
 */
@Component({
  selector: 'async-admin-automation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Automation</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>Automation</h2>
          <p class="subtitle">Background sweeps that move money and leads — green means fired recently, stale means go check the server.</p>
        </div>
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      <div class="stat-grid">
        @for (row of rows(); track row.job) {
          <mat-card [class.card--stale]="row.stale">
            <mat-card-content>
              <mat-icon>{{ row.stale ? 'warning' : 'check_circle' }}</mat-icon>
              <span class="stat-value">
                {{ row.neverRan ? 'Never' : row.lastOk === false ? 'Failing' : row.stale ? 'Stale' : 'Healthy' }}
              </span>
              <span class="stat-label">{{ label(row.job) }} · every {{ cadence(row) }}</span>
              <span class="muted">
                @if (row.lastFinishedAt) {
                  Last run {{ ageOf(row.lastFinishedAt) }} · {{ row.runs }} runs, {{ row.fails }} failed
                } @else {
                  No recorded run yet — the sweep has never fired on this deploy.
                }
              </span>
              @if (!row.lastOk && row.lastError) {
                <span class="err">Last error: {{ row.lastError }}</span>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75em; }
    .stat-grid mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .stat-grid mat-icon { color: var(--ms-success); }
    .card--stale { border-left: 4px solid var(--ms-error); }
    .card--stale mat-icon { color: var(--ms-error); }
    .stat-value { font-size: 1.5em; font-weight: 700; }
    .stat-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .err { color: var(--ms-error); font-size: 0.85em; word-break: break-word; }
  `],
})
export class AdminAutomationComponent implements OnInit {
  private readonly health = inject(JobHealthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<JobHealthRow[]>([]);

  ngOnInit(): void {
    this.reload();
  }

  protected label(job: string): string {
    return this.health.label(job);
  }

  protected cadence(row: JobHealthRow): string {
    const mins = row.expectedEveryMin;
    if (mins >= 1440) return `${Math.round(mins / 60)}h`;
    if (mins >= 60) return `${Math.round(mins / 60 * 10) / 10}h`;
    return `${mins}m`;
  }

  protected ageOf(at: string | null): string {
    return at ? timeAgo(new Date(at)) : '—';
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.health
      .health()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
