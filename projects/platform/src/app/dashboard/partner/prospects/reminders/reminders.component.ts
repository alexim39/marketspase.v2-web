import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { ReminderEntry, RemindersData } from '../lead-pipeline/lead.models';
import { ApiError } from '../../../../core/http/api-error';

type ReminderFilter = 'all' | 'overdue' | 'today' | 'upcoming';

interface ReminderGroup {
  key: Exclude<ReminderFilter, 'all'>;
  label: string;
  icon: string;
  items: ReminderEntry[];
  caption: (r: ReminderEntry) => string;
}

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
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
        <span>Reminders</span>
      </div>
    </section>

    <section class="reminders-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Pipeline · Follow-up promises</p>
          <h1>Reminders</h1>
          <p class="subtitle">Promises you made, ordered by urgency. Keep them and the pipeline moves; logging a fresh touch clears the reminder.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <a mat-flat-button color="primary" routerLink="/dashboard/prospects/pipeline">
            <mat-icon>view_kanban</mat-icon>
            Open pipeline
          </a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="list" [rows]="4" label="reminders" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (data(); as d) {
        <section class="summary-strip" aria-label="Reminder summary">
          <div class="summary-card summary-card--bad">
            <span class="summary-icon"><mat-icon>report</mat-icon></span>
            <div><strong>{{ stats().overdue }}</strong><span>Overdue</span><small>{{ stats().maxOverdue > 0 ? 'up to ' + stats().maxOverdue + ' days late' : 'nothing late' }}</small></div>
          </div>
          <div class="summary-card summary-card--warn">
            <span class="summary-icon"><mat-icon>today</mat-icon></span>
            <div><strong>{{ stats().today }}</strong><span>Due today</span><small>Clear these first</small></div>
          </div>
          <div class="summary-card summary-card--info">
            <span class="summary-icon"><mat-icon>event_upcoming</mat-icon></span>
            <div><strong>{{ stats().upcoming }}</strong><span>Coming up</span><small>Plan ahead</small></div>
          </div>
          <div class="summary-card">
            <span class="summary-icon"><mat-icon>checklist</mat-icon></span>
            <div><strong>{{ stats().total }}</strong><span>Total promises</span><small>Across your pipeline</small></div>
          </div>
        </section>

        @if (focus(); as f) {
          <section class="focus-card" [class.focus-card--today]="f.bucket === 'today'">
            <div class="focus-copy">
              <p class="eyebrow">{{ f.bucket === 'overdue' ? 'Start here · oldest promise' : 'Start here · due today' }}</p>
              <h2>{{ f.entry.name }}</h2>
              <p>
                @if (f.bucket === 'overdue') {
                  {{ f.entry.daysOverdue }} day{{ f.entry.daysOverdue === 1 ? '' : 's' }} overdue — the commitment was for {{ f.entry.followUpDate | date:'mediumDate' }}.
                } @else {
                  The follow-up is due today. A quick message keeps the relationship warm.
                }
              </p>
            </div>
            <div class="focus-actions">
              <a mat-flat-button color="primary" [routerLink]="['/dashboard/prospects/detail', f.entry.prospectId]">Open prospect</a>
              <a mat-stroked-button routerLink="/dashboard/prospects/pipeline">View pipeline</a>
            </div>
          </section>
        }

        @if (d.total > 0) {
          <div class="toolbar-card">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>Find a prospect</mat-label>
              <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value)" aria-label="Search reminders" />
            </mat-form-field>
            <div class="filter-row" role="radiogroup" aria-label="Reminder bucket">
              <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">All <span>{{ stats().total }}</span></button>
              <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'overdue'" [attr.aria-pressed]="filter() === 'overdue'" (click)="filter.set('overdue')">Overdue <span>{{ stats().overdue }}</span></button>
              <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'today'" [attr.aria-pressed]="filter() === 'today'" (click)="filter.set('today')">Today <span>{{ stats().today }}</span></button>
              <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'upcoming'" [attr.aria-pressed]="filter() === 'upcoming'" (click)="filter.set('upcoming')">Upcoming <span>{{ stats().upcoming }}</span></button>
            </div>
          </div>
        }

        @if (filteredGroups().length > 0) {
          <div class="bucket-stack">
            @for (group of filteredGroups(); track group.key) {
              <section class="bucket" [class.bucket--overdue]="group.key === 'overdue'" [class.bucket--today]="group.key === 'today'">
                <header class="bucket-head">
                  <span class="bucket-icon"><mat-icon>{{ group.icon }}</mat-icon></span>
                  <div><h2>{{ group.label }}</h2><p>{{ group.items.length }} promise{{ group.items.length === 1 ? '' : 's' }} in this bucket</p></div>
                  <span class="bucket-count">{{ group.items.length }}</span>
                </header>
                <ul class="reminder-list">
                  @for (r of group.items; track r.prospectId) {
                    <li class="reminder-row">
                      <span class="row-status" [class.row-status--overdue]="group.key === 'overdue'" [class.row-status--today]="group.key === 'today'">
                        <mat-icon>{{ group.key === 'overdue' ? 'priority_high' : group.key === 'today' ? 'today' : 'schedule' }}</mat-icon>
                      </span>
                      <div class="reminder-body">
                        <a [routerLink]="['/dashboard/prospects/detail', r.prospectId]"><strong>{{ r.name }}</strong></a>
                        <span class="muted">{{ group.caption(r) }} · due {{ r.followUpDate | date:'mediumDate' }}</span>
                      </div>
                      <span class="due-chip" [class.due-chip--overdue]="group.key === 'overdue'" [class.due-chip--today]="group.key === 'today'">
                        {{ group.key === 'overdue' ? r.daysOverdue + 'd late' : group.key === 'today' ? 'Today' : (r.followUpDate | date:'MMM d') }}
                      </span>
                      <a mat-stroked-button class="open-btn" [routerLink]="['/dashboard/prospects/detail', r.prospectId]">Open</a>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
          <p class="footnote"><mat-icon>info</mat-icon> Reminders clear automatically when you log a fresh touch on the prospect.</p>
        } @else if (d.total === 0) {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>task_alt</mat-icon></span>
            <h2>Every promise is kept</h2>
            <p>No follow-ups are due. Add a prospect or open the pipeline to create your next commitment.</p>
            <div class="empty-actions">
              <a mat-flat-button color="primary" routerLink="/dashboard/prospects/new">Add a prospect</a>
              <a mat-stroked-button routerLink="/dashboard/prospects/pipeline">Open pipeline</a>
            </div>
          </div>
        } @else {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>filter_alt_off</mat-icon></span>
            <h2>No reminders match</h2>
            <p>Try another name or bucket to see the rest of your follow-ups.</p>
            <button mat-stroked-button type="button" (click)="query.set(''); filter.set('all')">Clear filters</button>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .reminders-page { display: flex; flex-direction: column; gap: 24px; max-width: 1100px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 6px; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-card--bad { background: var(--ms-error-soft); }
    .summary-card--warn { background: var(--ms-warning-soft); }
    .summary-card--info { background: var(--ms-info-soft); }
    .summary-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-surface); color: var(--ms-text-muted); }
    .summary-card--bad .summary-icon { color: var(--ms-error); }
    .summary-card--warn .summary-icon { color: var(--ms-warning); }
    .summary-card--info .summary-icon { color: var(--ms-primary-strong); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.6875rem; }

    .focus-card { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; padding: 24px; border-radius: var(--ms-radius-lg); border: 1px solid var(--ms-error); background: linear-gradient(135deg, var(--ms-error-soft), var(--ms-surface)); }
    .focus-card--today { border-color: var(--ms-warning); background: linear-gradient(135deg, var(--ms-warning-soft), var(--ms-surface)); }
    .focus-copy h2 { margin: 4px 0; font-size: 1.375rem; }
    .focus-copy p { margin: 0; max-width: 56em; color: var(--ms-text-muted); line-height: 1.6; }
    .focus-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .focus-actions a { min-height: 44px; }

    .toolbar-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .search-field { flex: 1; min-width: 240px; }
    .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text); font: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    .filter-btn:hover { border-color: var(--ms-primary); }
    .filter-btn span { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .filter-btn--active span { background: var(--ms-surface); color: var(--ms-primary-strong); }

    .bucket-stack { display: flex; flex-direction: column; gap: 16px; }
    .bucket { border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); overflow: hidden; }
    .bucket--overdue { border-left: 3px solid var(--ms-error); }
    .bucket--today { border-left: 3px solid var(--ms-warning); }
    .bucket-head { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--ms-line); background: var(--ms-canvas); flex-wrap: wrap; }
    .bucket-icon { width: 36px; height: 36px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-surface); color: var(--ms-text-muted); }
    .bucket--overdue .bucket-icon { color: var(--ms-error); }
    .bucket--today .bucket-icon { color: var(--ms-warning); }
    .bucket-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .bucket-head h2 { margin: 0; font-size: 1rem; }
    .bucket-head p { margin: 1px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; }
    .bucket-count { margin-left: auto; padding: 3px 10px; border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; }
    .reminder-list { list-style: none; margin: 0; padding: 0; }
    .reminder-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--ms-line); flex-wrap: wrap; }
    .reminder-row:last-child { border-bottom: 0; }
    .row-status { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .row-status--overdue { background: var(--ms-error-soft); color: var(--ms-error); }
    .row-status--today { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .row-status mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .reminder-body { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 1px; }
    .reminder-body a { color: inherit; text-decoration: none; }
    .reminder-body a:hover strong { color: var(--ms-primary-strong); }
    .muted { color: var(--ms-text-muted); font-size: 0.8125rem; }
    .due-chip { flex: none; padding: 4px 10px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
    .due-chip--overdue { background: var(--ms-error-soft); color: var(--ms-error); }
    .due-chip--today { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .open-btn { min-height: 40px; }
    .footnote { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; }
    .footnote mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; text-align: center; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .empty-card p { margin: 0; max-width: 42em; line-height: 1.6; }
    .empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .empty-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    .empty-actions a { min-height: 44px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    @media (max-width: 900px) { .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) {
      .summary-strip { grid-template-columns: minmax(0, 1fr); }
      .reminder-row { align-items: flex-start; }
      .open-btn { margin-left: 44px; }
      .filter-btn { flex: 1; justify-content: center; }
    }
  `],
})
export class RemindersComponent implements OnInit {
  private readonly reminders = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<RemindersData | null>(null);
  protected readonly query = signal('');
  protected readonly filter = signal<ReminderFilter>('all');

  protected readonly stats = computed(() => {
    const d = this.data();
    const overdue = d?.overdue ?? [];
    return {
      overdue: overdue.length,
      today: d?.today?.length ?? 0,
      upcoming: d?.upcoming?.length ?? 0,
      total: d?.total ?? 0,
      maxOverdue: overdue.reduce((max, item) => Math.max(max, Number(item.daysOverdue ?? 0)), 0),
    };
  });

  protected readonly focus = computed(() => {
    const d = this.data();
    if (!d) return null;
    if (d.overdue.length > 0) return { entry: d.overdue[0], bucket: 'overdue' as const };
    if (d.today.length > 0) return { entry: d.today[0], bucket: 'today' as const };
    return null;
  });

  protected readonly filteredGroups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.query().trim().toLowerCase();
    const active = this.filter();
    return this.groups(d)
      .filter((group) => active === 'all' || group.key === active)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !q || String(item.name ?? '').toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  });

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

  protected groups(d: RemindersData): ReminderGroup[] {
    return [
      {
        key: 'overdue',
        label: 'Overdue',
        icon: 'report',
        items: d.overdue,
        caption: (r) => `${r.daysOverdue}d overdue`,
      },
      {
        key: 'today',
        label: 'Due today',
        icon: 'priority_high',
        items: d.today,
        caption: () => 'due today',
      },
      {
        key: 'upcoming',
        label: 'Coming up',
        icon: 'event_note',
        items: d.upcoming,
        caption: () => 'upcoming',
      },
    ];
  }
}
