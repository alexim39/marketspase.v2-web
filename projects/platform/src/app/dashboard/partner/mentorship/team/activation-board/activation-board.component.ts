import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoardItem } from '../../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../../core/http/api-error';

type BoardFilter = 'all' | 'attention' | 'overdue' | 'no-list' | 'done';

const PAGE_SIZE = 10;

/**
 * @title Activation board — who needs you next.
 *
 * One light row per downline member: IPO/QSG stamps, list totals, oldest
 * pending age, 48h overdue flag and the single next action. No contact
 * arrays, so huge downlines stay cheap (10 rows per page).
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-activation-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/team">Team</a> &gt;
        <span>Activation board</span>
      </div>
    </section>

    <section class="board-page">
      <div class="page-head">
        <div>
          <h2>Activation board</h2>
          <p class="subtitle">Your team, oldest need first - IPO/QSG/SMO/Leadership progress, list work and the one next move per member.</p>
        </div>
        <div class="head-actions">
          <a mat-button routerLink="../contact-lists">Warm lists</a>
          <button mat-button (click)="reload()" [disabled]="loading()">Refresh</button>
        </div>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="board" [rows]="3" label="activation board" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (!loading() && !error() && items().length > 0) {
        <div class="chip-row" role="status">
          <mat-chip highlighted>{{ totalMembers() || items().length }} member{{ (totalMembers() || items().length) === 1 ? '' : 's' }}</mat-chip>
          <mat-chip highlighted>{{ needWorkCount() }} need work</mat-chip>
          @if (overdueCount() > 0) {
            <mat-chip color="warn" highlighted>{{ overdueCount() }} overdue 48h</mat-chip>
          }
          @if (noListCount() > 0) {
            <mat-chip highlighted>{{ noListCount() }} no list yet</mat-chip>
          }
        </div>

        <div class="toolbar">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Search member or username</mat-label>
            <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value); page.set(0)" />
          </mat-form-field>
          <div class="filter-row" role="radiogroup" aria-label="Board filter">
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all'); page.set(0)">All</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'attention'" [attr.aria-pressed]="filter() === 'attention'" (click)="filter.set('attention'); page.set(0)">Needs attention</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'overdue'" [attr.aria-pressed]="filter() === 'overdue'" (click)="filter.set('overdue'); page.set(0)">Overdue</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'no-list'" [attr.aria-pressed]="filter() === 'no-list'" (click)="filter.set('no-list'); page.set(0)">No list</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'done'" [attr.aria-pressed]="filter() === 'done'" (click)="filter.set('done'); page.set(0)">Done</button>
          </div>
        </div>
      }

      @if (paged().length > 0) {
        <p class="muted" role="status">
          Showing {{ paged().length }} of {{ filtered().length }} matching
          @if (totalMembers() > items().length) {
            <span>· first {{ items().length }} most urgent of {{ totalMembers() }} — search to narrow</span>
          }
        </p>
        <ul class="member-list">
          @for (m of paged(); track m.partnerId) {
            <li class="dp-card member" [class.member--overdue]="m.overdue">
              <div class="member-head">
                <div>
                  <strong>{{ m.member?.name ?? 'Team member' }}</strong>
                  <span class="muted"> @{{ m.member?.username ?? '—' }}</span>
                  <div class="muted relation">{{ m.relation || 'Direct' }}</div>
                </div>
                <span class="dp-status {{ toneClass(m.nextTone) }}">{{ m.nextAction }}</span>
              </div>
              <div class="entry-tags">
                <mat-chip highlighted>IPO: {{ m.ipoDone ? 'done' : 'pending' }}</mat-chip>
                <mat-chip highlighted>QSG: {{ m.qsgDone ? 'done' : 'pending' }}</mat-chip>
                <mat-chip highlighted>SMO: {{ m.smoDone ? 'done' : 'pending' }}</mat-chip>
                <mat-chip highlighted>{{ m.lists }} list{{ m.lists === 1 ? '' : 's' }} · {{ m.worked }}/{{ m.total }} worked</mat-chip>
                @if (m.overdue) {
                  <mat-chip color="warn" highlighted>Overdue 48h</mat-chip>
                } @else if (m.unworked > 0 && m.oldestPendingAt) {
                  <mat-chip highlighted>Waiting since {{ m.oldestPendingAt | date:'mediumDate' }}</mat-chip>
                }
              </div>
              @if (m.total > 0) {
                <mat-progress-bar mode="determinate" [value]="m.total ? (m.worked / m.total) * 100 : 0" aria-label="Progress" />
              }
              <div class="member-actions">
                <a mat-button routerLink="../contact-lists" [queryParams]="memberQuery(m)" aria-label="Work {{ m.member?.name ?? 'member' }} lists">Work lists</a>
                <a mat-button [routerLink]="['/dashboard/mentorship/partners/my-partners/detail', m.partnerId]" aria-label="Open {{ m.member?.name ?? 'member' }} profile">Open member</a>
              </div>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <div class="pager">
            <button mat-button (click)="prev()" [disabled]="page() === 0">Previous</button>
            <span class="muted" role="status">Page {{ page() + 1 }} of {{ totalPages() }}</span>
            <button mat-button (click)="next()" [disabled]="page() + 1 >= totalPages()">Next</button>
          </div>
        }
      } @else if (!loading() && !error()) {
        @if (items().length === 0) {
          <div class="empty-card">
            <mat-icon>group_add</mat-icon>
            <p><strong>No downline yet.</strong></p>
            <p class="muted">When partners join or are placed under you, each gets one row here with IPO/QSG/SMO/Leadership, list progress and the next move.</p>
            <a mat-button routerLink="/dashboard/mentorship/partners/my-partners">Check my downline</a>
          </div>
        } @else {
          <p class="empty">No members match — <button mat-button (click)="clearSearch()">clear search</button></p>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .board-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .head-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .head-actions button, .head-actions a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .chip-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; }
    .toolbar mat-form-field { flex: 1; min-width: 220px; }
    .filter-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .filter-btn { border: 1px solid var(--ms-line); background: transparent; border-radius: 999px; padding: 0.5em 1em; min-height: 44px; cursor: pointer; color: inherit; font: inherit; font-size: 0.85rem; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
    .member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; }
    .member { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .member--overdue { border-left: 4px solid var(--ms-error); }
    .member-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .relation { margin-top: 0.15em; font-weight: bold; }
    .entry-tags { display: flex; gap: 0.3em; flex-wrap: wrap; }
    .member-actions { display: flex; gap: 0.4em; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .member-actions a { min-height: 44px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 1em; }
    .pager button { min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.4em; text-align: center; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em; color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
    .empty-card p { margin: 0; max-width: 38em; }
    .empty-card a { min-height: 44px; }
  `],
})
export class ActivationBoardComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ActivationBoardItem[]>([]);
  protected readonly totalMembers = signal(0);
  protected readonly query = signal('');
  protected readonly filter = signal<BoardFilter>('all');
  protected readonly page = signal(0);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.items().filter((m) => {
      if (f === 'attention' && !(m.overdue || m.unworked > 0 || m.total === 0 || !m.ipoDone || !m.qsgDone || !m.smoDone)) return false;
      if (f === 'overdue' && !m.overdue) return false;
      if (f === 'no-list' && m.total > 0) return false;
      if (f === 'done' && !this.isDone(m)) return false;
      if (!q) return true;
      return `${m.member?.name ?? ''} ${m.member?.username ?? ''}`.toLowerCase().includes(q);
    });
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  protected readonly paged = computed(() => {
    const p = Math.min(this.page(), this.totalPages() - 1);
    return this.filtered().slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  });

  protected readonly needWorkCount = computed(() => this.items().filter((m) => m.unworked > 0 || m.total === 0).length);
  protected readonly overdueCount = computed(() => this.items().filter((m) => m.overdue).length);
  protected readonly noListCount = computed(() => this.items().filter((m) => m.total === 0).length);

  ngOnInit(): void {
    this.reload();
  }

  protected isDone(m: ActivationBoardItem): boolean {
    return m.ipoDone && m.qsgDone && m.smoDone && m.total > 0 && m.unworked === 0;
  }

  /** Deep link into the workbench pre-filtered to this member. */
  protected memberQuery(m: ActivationBoardItem): Record<string, string> {
    const q = (m.member?.username ?? m.member?.name ?? '').trim();
    return q ? { member: q } : {};
  }

  protected toneClass(tone: ActivationBoardItem['nextTone']): string {
    switch (tone) {
      case 'bad': return 'dp-status--bad';
      case 'warn': return 'dp-status--warn';
      case 'info': return 'dp-status--info';
      default: return 'dp-status--ok';
    }
  }

  protected prev(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  protected next(): void {
    this.page.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }

  protected clearSearch(): void {
    this.query.set('');
    this.filter.set('all');
    this.page.set(0);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .activationBoard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.items.set(res.data?.items ?? []);
          this.totalMembers.set(res.data?.total ?? (res.data?.items ?? []).length);
          this.page.set(0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
