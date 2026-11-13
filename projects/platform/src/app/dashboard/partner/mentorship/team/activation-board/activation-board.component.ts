import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoardItem } from '../../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../../core/http/api-error';

type BoardFilter = 'all' | 'needs' | 'done';

const PAGE_SIZE = 10;

/**
 * @title Activation board — who needs training next.
 *
 * One light row per downline member: level, confirmed IPO/QSG/SMO stamps and
 * the next training action. Warm-list/contact-list work was retired.
 */
@Component({
  selector: 'async-activation-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/team">Team</a> &gt;
        <span>Activation board</span>
      </div>
    </section>

    <section class="board-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Mentorship · Activation</p>
          <h1>Activation board</h1>
          <p class="subtitle">Every downline member, their confirmed training stamps and the single next move that keeps them progressing.</p>
        </div>
        <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Refresh board
        </button>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="board" [rows]="3" label="activation board" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!loading() && !error() && items().length > 0) {
        <section class="hero-card">
          <div class="hero-main">
            <span class="hero-label">Training coverage</span>
            <div class="hero-figure">
              <strong>{{ completionRate() }}%</strong>
              <span>of this board fully activated</span>
            </div>
            <div class="hero-track" role="progressbar" [attr.aria-valuenow]="completionRate()" aria-valuemin="0" aria-valuemax="100" aria-label="Team training coverage">
              <span [style.width.%]="completionRate()"></span>
            </div>
            <p>IPO, QSG and SMO must all be confirmed before a member is counted as activated. Focus on the members below with pending stamps.</p>
          </div>
          <div class="hero-stats" role="status">
            <div class="hero-stat">
              <span>Members</span>
              <strong>{{ totalMembers() || items().length }}</strong>
              <small>in your downline</small>
            </div>
            <div class="hero-stat">
              <span>Need training</span>
              <strong>{{ needWorkCount() }}</strong>
              <small>with pending stamps</small>
            </div>
            <div class="hero-stat">
              <span>Activated</span>
              <strong>{{ completedCount() }}</strong>
              <small>all stamps confirmed</small>
            </div>
            <div class="hero-stat">
              <span>At risk</span>
              <strong>{{ atRiskCount() }}</strong>
              <small>need a check-in</small>
            </div>
          </div>
        </section>

        <div class="toolbar-card">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Search member or username</mat-label>
            <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value); page.set(0)" />
          </mat-form-field>
          <div class="filter-row" role="radiogroup" aria-label="Board filter">
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all'); page.set(0)">
              All <span>{{ items().length }}</span>
            </button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'needs'" [attr.aria-pressed]="filter() === 'needs'" (click)="filter.set('needs'); page.set(0)">
              Needs training <span>{{ needWorkCount() }}</span>
            </button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'done'" [attr.aria-pressed]="filter() === 'done'" (click)="filter.set('done'); page.set(0)">
              Activated <span>{{ completedCount() }}</span>
            </button>
          </div>
        </div>
      }

      @if (paged().length > 0) {
        <div class="results-meta" role="status">
          <span>Showing {{ paged().length }} of {{ filtered().length }} matching member{{ filtered().length === 1 ? '' : 's' }}</span>
          @if (totalMembers() > items().length) {
            <span>First {{ items().length }} most urgent of {{ totalMembers() }} — search to narrow</span>
          }
        </div>
        <ul class="member-list">
          @for (m of paged(); track m.partnerId) {
            <li class="member-card" [class.member-card--done]="isDone(m)">
              <div class="member-head">
                <span class="avatar" aria-hidden="true">{{ initials(m.member?.name) }}</span>
                <div class="member-identity">
                  <strong>{{ m.member?.name ?? 'Team member' }}</strong>
                  <span class="member-meta">&#64;{{ m.member?.username ?? '—' }} · {{ m.relation || 'Direct' }} · {{ m.levelLabel || 'Partner' }}</span>
                </div>
                <span class="status-pill {{ toneClass(m.nextTone) }}">{{ m.nextAction }}</span>
              </div>

              <div class="stamps" aria-label="Training stamps">
                <span class="stamp" [class.stamp--done]="m.ipoDone">
                  <mat-icon>{{ m.ipoDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span><strong>IPO</strong><small>{{ m.ipoDone ? 'Confirmed' : 'Pending' }}</small></span>
                </span>
                <span class="stamp" [class.stamp--done]="m.qsgDone">
                  <mat-icon>{{ m.qsgDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span><strong>QSG</strong><small>{{ m.qsgDone ? 'Confirmed' : 'Pending' }}</small></span>
                </span>
                <span class="stamp" [class.stamp--done]="m.smoDone">
                  <mat-icon>{{ m.smoDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span><strong>SMO</strong><small>{{ m.smoDone ? 'Confirmed' : 'Pending' }}</small></span>
                </span>
              </div>

              @if (m.playbook; as p) {
                <div class="playbook" [class.playbook--risk]="p.atRisk">
                  <div class="playbook-head">
                    <span><strong>First 7 days</strong> · {{ p.completed }}/{{ p.total }} complete</span>
                    @if (p.atRisk) { <span class="risk-chip">At risk</span> }
                    @if (p.mentorBonus; as bonus) {
                      <span class="bonus-chip">Mentor bonus: {{ bonus.status }}</span>
                    }
                  </div>
                  <div class="task-row">
                    @for (task of p.tasks; track task.key) {
                      <span class="task" [class.task--done]="task.done">
                        <mat-icon>{{ task.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        {{ task.label }}
                      </span>
                    }
                  </div>
                  <div class="checkin-row">
                    <span class="checkin-meta">
                      Check-ins {{ p.checkins.count }}
                      @if (p.checkins.lastAt) { · last {{ p.checkins.lastAt | date:'mediumDate' }} }
                      @if (p.checkins.nextKind) { · next {{ checkinLabel(p.checkins.nextKind) }} }
                    </span>
                    @if (checkinId() === m.partnerId) {
                      <div class="checkin-form">
                        <input type="text" [value]="checkinNote()" (input)="checkinNote.set($any($event.target).value)" maxlength="500" placeholder="What did you discuss?" aria-label="Check-in note" />
                        <button mat-flat-button color="primary" type="button" (click)="saveCheckin(m)" [disabled]="checkinBusy()">{{ checkinBusy() ? 'Saving…' : 'Save check-in' }}</button>
                        <button mat-button type="button" (click)="cancelCheckin()">Cancel</button>
                      </div>
                    } @else {
                      <button mat-stroked-button type="button" (click)="startCheckin(m)">Log {{ p.checkins.nextKind ? checkinLabel(p.checkins.nextKind) : 'check-in' }}</button>
                    }
                  </div>
                </div>
              }

              <div class="member-foot">
                <div class="member-progress">
                  <span>{{ doneCount(m) }} of 3 steps complete</span>
                  <div class="mini-track" aria-hidden="true"><span [style.width.%]="progressPct(m)"></span></div>
                </div>
                <a mat-stroked-button [routerLink]="['/dashboard/mentorship/partners/my-partners/detail', m.partnerId]">
                  Open member
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              </div>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <div class="pager">
            <button mat-stroked-button type="button" (click)="prev()" [disabled]="page() === 0">
              <mat-icon>chevron_left</mat-icon>
              Previous
            </button>
            <span class="muted" role="status">Page {{ page() + 1 }} of {{ totalPages() }}</span>
            <button mat-stroked-button type="button" (click)="next()" [disabled]="page() + 1 >= totalPages()">
              Next
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        }
      } @else if (!loading() && !error()) {
        @if (items().length === 0) {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>group_add</mat-icon></span>
            <h2>No downline yet</h2>
            <p>When partners join or are placed under you, each gets one row here with training progress and the next move.</p>
            <a mat-flat-button color="primary" routerLink="/dashboard/mentorship/partners/my-partners">Check my downline</a>
          </div>
        } @else {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>filter_alt_off</mat-icon></span>
            <h2>No members match</h2>
            <p>Try a different name or clear the training filter.</p>
            <button mat-stroked-button type="button" (click)="clearSearch()">Clear search</button>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .board-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 58em; line-height: 1.6; }
    .page-head button mat-icon { margin-right: 6px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .hero-card { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 32px; align-items: center; padding: 32px; border-radius: var(--ms-radius-2xl); background: linear-gradient(125deg, #121024 0%, #24204b 58%, #3f4bb8 100%); color: #fff; box-shadow: var(--ms-shadow-md); }
    .hero-label { color: rgba(255, 255, 255, 0.66); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .hero-figure { display: flex; align-items: baseline; gap: 12px; margin: 8px 0 12px; flex-wrap: wrap; }
    .hero-figure strong { font-family: var(--ms-font-display); font-size: clamp(2.75rem, 5vw, 4rem); line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .hero-figure span { color: rgba(255, 255, 255, 0.72); font-size: 0.9375rem; }
    .hero-track { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.16); overflow: hidden; }
    .hero-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #818cf8, #4ade80); transition: width 320ms ease; }
    .hero-main p { margin: 12px 0 0; max-width: 48em; color: rgba(255, 255, 255, 0.7); font-size: 0.9375rem; line-height: 1.6; }
    .hero-stats { display: grid; gap: 8px; }
    .hero-stat { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); flex-wrap: wrap; }
    .hero-stat span { color: rgba(255, 255, 255, 0.68); font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .hero-stat strong { font-family: var(--ms-font-display); font-size: 1.75rem; font-variant-numeric: tabular-nums; }
    .hero-stat small { width: 100%; color: rgba(255, 255, 255, 0.6); font-size: 0.75rem; }
    .toolbar-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .search-field { flex: 1; min-width: 240px; }
    .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 8px 16px; min-height: 44px; cursor: pointer; font: inherit; font-size: 0.875rem; font-weight: 500; transition: border-color 160ms ease, background 160ms ease; }
    .filter-btn:hover { border-color: var(--ms-primary); }
    .filter-btn span { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .filter-btn--active span { background: var(--ms-surface); color: var(--ms-primary-strong); }
    .results-meta { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.8125rem; }
    .member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .member-card { display: flex; flex-direction: column; gap: 16px; padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); box-shadow: var(--ms-shadow-sm); transition: border-color 160ms ease; }
    .member-card:hover { border-color: var(--ms-primary); }
    .member-card--done { border-left: 3px solid var(--ms-success); }
    .member-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .avatar { flex: none; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-family: var(--ms-font-display); font-size: 1rem; font-weight: 700; letter-spacing: 0.02em; }
    .member-identity { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 2px; }
    .member-identity strong { font-size: 1.0625rem; font-weight: 600; }
    .member-meta { color: var(--ms-text-muted); font-size: 0.8125rem; overflow-wrap: anywhere; }
    .status-pill { border-radius: 999px; padding: 6px 14px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .stamps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stamp { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); color: var(--ms-text-muted); }
    .stamp mat-icon { color: var(--ms-text-muted); }
    .stamp span { display: flex; flex-direction: column; gap: 1px; }
    .stamp strong { color: var(--ms-text); font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.04em; }
    .stamp small { font-size: 0.75rem; }
    .stamp--done { background: var(--ms-success-soft); border-color: transparent; color: var(--ms-success); }
    .stamp--done mat-icon { color: var(--ms-success); }
    .stamp--done strong { color: var(--ms-success); }
    .playbook { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-canvas); border: 1px solid var(--ms-line); }
    .playbook--risk { border-color: var(--ms-warning); background: var(--ms-warning-soft); }
    .playbook-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.75rem; }
    .playbook-head strong { color: var(--ms-text); }
    .risk-chip { padding: 2px 8px; border-radius: 999px; background: var(--ms-warning); color: #fff; font-size: 0.6875rem; font-weight: 700; }
    .bonus-chip { padding: 2px 8px; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.6875rem; font-weight: 700; text-transform: capitalize; }
    .task-row { display: flex; gap: 6px 12px; flex-wrap: wrap; }
    .task { display: inline-flex; align-items: center; gap: 4px; color: var(--ms-text-muted); font-size: 0.75rem; }
    .task mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .task--done { color: var(--ms-success); }
    .checkin-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 8px; }
    .checkin-meta { color: var(--ms-text-muted); font-size: 0.75rem; flex: 1; min-width: 200px; }
    .checkin-form { display: flex; gap: 8px; flex-wrap: wrap; flex: 1 1 100%; }
    .checkin-form input { flex: 1; min-width: 180px; min-height: 40px; padding: 0 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-surface); color: var(--ms-text); font: inherit; }
    .checkin-row button { min-height: 36px; }
    .member-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .member-progress { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
    .member-progress span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.03em; }
    .mini-track { height: 4px; width: 100%; max-width: 320px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .mini-track span { display: block; height: 100%; border-radius: inherit; background: var(--ms-primary); }
    .member-foot a mat-icon { margin-left: 4px; font-size: 18px; width: 18px; height: 18px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; }
    .pager mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .muted { color: var(--ms-text-muted); font-size: 0.875rem; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .empty-card p { margin: 0; max-width: 40em; line-height: 1.6; }
    .empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .dp-status--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .dp-status--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .dp-status--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .dp-status--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    @media (max-width: 900px) {
      .hero-card { grid-template-columns: minmax(0, 1fr); padding: 24px; }
      .member-card { padding: 16px; }
    }
    @media (max-width: 640px) {
      .board-page { gap: 16px; }
      .stamps { grid-template-columns: minmax(0, 1fr); }
      .filter-row { width: 100%; }
      .filter-btn { flex: 1; justify-content: center; }
      .member-foot a { width: 100%; justify-content: center; }
    }
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
      const done = this.isDone(m);
      if (f === 'needs' && done) return false;
      if (f === 'done' && !done) return false;
      if (!q) return true;
      return `${m.member?.name ?? ''} ${m.member?.username ?? ''}`.toLowerCase().includes(q);
    });
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  protected readonly paged = computed(() => {
    const p = Math.min(this.page(), this.totalPages() - 1);
    return this.filtered().slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  });

  protected readonly needWorkCount = computed(() => this.items().filter((m) => !this.isDone(m)).length);

  protected readonly completedCount = computed(() => this.items().filter((m) => this.isDone(m)).length);
  protected readonly atRiskCount = computed(() => this.items().filter((m) => m.playbook?.atRisk).length);

  protected readonly checkinId = signal<string | null>(null);
  protected readonly checkinNote = signal('');
  protected readonly checkinBusy = signal(false);

  protected readonly completionRate = computed(() => {
    const total = this.items().length;
    if (!total) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  protected doneCount(m: ActivationBoardItem): number {
    return [m.ipoDone, m.qsgDone, m.smoDone].filter(Boolean).length;
  }

  protected progressPct(m: ActivationBoardItem): number {
    return Math.round((this.doneCount(m) / 3) * 100);
  }

  protected initials(name?: string | null): string {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TM';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return `${first}${last}`.toUpperCase();
  }

  ngOnInit(): void {
    this.reload();
  }

  protected isDone(m: ActivationBoardItem): boolean {
    return m.ipoDone && m.qsgDone && m.smoDone;
  }

  protected toneClass(tone: ActivationBoardItem['nextTone']): string {
    switch (tone) {
      case 'bad': return 'dp-status--bad';
      case 'warn': return 'dp-status--warn';
      case 'info': return 'dp-status--info';
      default: return 'dp-status--ok';
    }
  }

  protected prev(): void { this.page.update((p) => Math.max(0, p - 1)); }
  protected next(): void { this.page.update((p) => Math.min(this.totalPages() - 1, p + 1)); }

  protected clearSearch(): void {
    this.query.set('');
    this.filter.set('all');
    this.page.set(0);
  }

  protected checkinLabel(kind: string | null): string {
    if (kind === 'welcome') return 'welcome call';
    if (kind === 'day3') return 'day 3 check-in';
    if (kind === 'day7') return 'day 7 review';
    return 'check-in';
  }

  protected startCheckin(m: ActivationBoardItem): void {
    this.checkinId.set(m.partnerId);
    this.checkinNote.set('');
  }

  protected cancelCheckin(): void {
    this.checkinId.set(null);
    this.checkinNote.set('');
    this.checkinBusy.set(false);
  }

  protected saveCheckin(m: ActivationBoardItem): void {
    if (this.checkinBusy()) return;
    const kind = (m.playbook?.checkins.nextKind ?? 'ad_hoc') as 'welcome' | 'day3' | 'day7' | 'ad_hoc';
    this.checkinBusy.set(true);
    this.leads.recordMentorCheckin(m.partnerId, kind, this.checkinNote())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.checkinBusy.set(false);
          this.checkinId.set(null);
          this.checkinNote.set('');
          this.reload();
        },
        error: (err: ApiError) => {
          this.checkinBusy.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads.activationBoard()
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
