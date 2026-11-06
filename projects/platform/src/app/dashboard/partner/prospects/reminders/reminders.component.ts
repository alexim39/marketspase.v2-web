import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { ReminderEntry, RemindersData } from '../lead-pipeline/lead.models';
import { ApiError } from '../../../../core/http/api-error';

/**
 * @title Reminders — follow-up commitments due.
 *
 * Overdue / today / upcoming buckets from each prospect's latest open
 * touch. Logging a fresh touch clears its reminder (mark-done by doing).
 * Read-only list; work happens on the prospect detail page.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-reminders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
        <span>Reminders</span>
      </div>
    </section>

    <section class="reminders-page">
      <div class="page-head">
        <div>
          <h2>Reminders</h2>
          <p class="subtitle">Promises you made — keep them and the pipeline moves.</p>
        </div>
        <a mat-button routerLink="/dashboard/prospects/pipeline">Open pipeline</a>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading reminders" />
        <div class="dp-card bucket sk" aria-hidden="true">
          <span class="sk-title"></span>
          <ul class="reminder-list">
            @for (i of [1, 2, 3]; track i) {
              <li>
                <span class="sk-dot"></span>
                <span class="sk-text"><span class="sk-line"></span><span class="sk-line short"></span></span>
              </li>
            }
          </ul>
        </div>
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (data(); as d) {
        @if (d.total === 0 && !loading()) {
          <p class="empty">Nothing due — every promise is kept or none was made.</p>
        }
        @for (group of groups(d); track group.key) {
          @if (group.items.length > 0) {
            <div class="dp-card bucket">
              <h3>{{ group.label }} ({{ group.items.length }})</h3>
              <ul class="reminder-list">
                @for (r of group.items; track r.prospectId) {
                  <li>
                    <mat-icon>{{ group.icon }}</mat-icon>
                    <div class="reminder-body">
                      <a [routerLink]="['/dashboard/prospects/detail', r.prospectId]"><strong>{{ r.name }}</strong></a>
                      <span class="muted">{{ group.caption(r) }} · due {{ r.followUpDate | date:'mediumDate' }}</span>
                    </div>
                  </li>
                }
              </ul>
            </div>
          }
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .reminders-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .bucket { padding: 1em; display: flex; flex-direction: column; gap: 0.5em; }
    .bucket h3 { margin: 0; font-size: 1em; }
    .reminder-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .reminder-list li { display: flex; gap: 0.6em; align-items: flex-start; padding: 0.55em 0; border-top: 1px solid var(--ms-line); }
    .reminder-list li:first-child { border-top: none; }
    .reminder-list mat-icon { color: var(--ms-primary-strong); font-size: 20px; height: 20px; width: 20px; flex: none; }
    .reminder-body { display: flex; flex-direction: column; gap: 0.1em; min-width: 0; }
    .reminder-body a { min-height: 44px; display: inline-flex; align-items: center; color: inherit; font-weight: 600; }
    /* Skeleton: shimmering stand-ins shaped like real rows, so a slow
     * network reads as "loading" instead of an empty gap. */
    .sk .sk-title {
      display: block; height: 1em; width: 11em; border-radius: 4px;
      background: var(--ms-primary-soft);
    }
    .sk-dot {
      width: 20px; height: 20px; border-radius: 50%; flex: none;
      background: var(--ms-primary-soft);
    }
    .sk-text { display: flex; flex-direction: column; gap: 0.35em; flex: 1; }
    .sk-line {
      display: block; height: 0.85em; border-radius: 4px;
      background: var(--ms-primary-soft);
    }
    .sk-line.short { width: 55%; opacity: 0.6; }
    .sk .sk-title, .sk-dot, .sk-line {
      animation: sk-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes sk-shimmer {
      0%, 100% { opacity: 0.45; }
      50% { opacity: 0.9; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk .sk-title, .sk-dot, .sk-line { animation: none; opacity: 0.6; }
    }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class RemindersComponent implements OnInit {
  private readonly reminders = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<RemindersData | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reminders
      .reminders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected groups(d: RemindersData): Array<{
    key: string; label: string; icon: string;
    items: ReminderEntry[]; caption: (r: ReminderEntry) => string;
  }> {
    return [
      {
        key: 'overdue', label: 'Overdue', icon: 'report',
        items: d.overdue,
        caption: (r) => `${r.daysOverdue}d overdue`,
      },
      {
        key: 'today', label: 'Due today', icon: 'priority_high',
        items: d.today,
        caption: () => 'due today',
      },
      {
        key: 'upcoming', label: 'Coming up', icon: 'event_note',
        items: d.upcoming,
        caption: () => 'upcoming',
      },
    ];
  }
}
