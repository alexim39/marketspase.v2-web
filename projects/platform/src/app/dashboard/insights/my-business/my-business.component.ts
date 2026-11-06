import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { DashboardOverview, TeamAnalytics } from '../../../core/analytics/analytics.models';
import { LeadPipelineService } from '../../partner/prospects/lead-pipeline/lead-pipeline.service';
import { ProspectLead } from '../../partner/prospects/lead-pipeline/lead.models';
import { NetworkService } from '../../network/tree/network.service';
import { NetworkNode } from '../../network/tree/network.models';
import { TrainingService } from '../../../core/training/training.service';
import { Readiness } from '../../../core/training/training.models';
import { GoalService } from '../../../core/goals/goal.service';
import { Goal } from '../../../core/goals/goal.models';
import { ApiError, userError } from '../../../core/http/api-error';

interface Step {
  icon: string;
  title: string;
  detail: string;
  link: string;
  cta: string;
}

/**
 * @title My Business — the partner's own business KPI page.
 *
 * The own-business mirror of the downline Business KPI panel: one screen
 * answering "how is MY business doing and what do I do next?" Team money,
 * pipeline health, training readiness and goals — all session-owned reads,
 * each fail-soft ("—" + retry). Next steps are self-directed and every CTA
 * deep-links to a working page. OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-my-business',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Insights</a> &gt;
        <span>My Business</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>My Business</h2>
          <p class="subtitle">Your numbers, one screen — money, pipeline, training, goals, and your next move.</p>
        </div>
        <div class="head-actions">
          <a mat-button routerLink="/dashboard/insights" title="Team health + funnel">Insights</a>
          <button mat-button (click)="reload()" [disabled]="loading()" aria-label="Refresh business data">Refresh</button>
        </div>
      </div>

      @if (loading() && !loadedOnce()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      <div class="kpi-grid">
        <mat-card><mat-card-content>
          <mat-icon>payments</mat-icon>
          <span class="kpi-value">{{ teamVolumeLabel() }}</span>
          <span class="kpi-label">Shop volume 30d</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>account_balance_wallet</mat-icon>
          <span class="kpi-value">{{ personalVolumeLabel() }}</span>
          <span class="kpi-label">Personal shop volume</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>group</mat-icon>
          <span class="kpi-value">{{ activeTeamLabel() }}</span>
          <span class="kpi-label">Active team</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>speed</mat-icon>
          <span class="kpi-value">{{ velocityLabel() }}</span>
          <span class="kpi-label">Recruits 7d / 30d</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>trending_up</mat-icon>
          <span class="kpi-value">{{ pipelineOpen() === null ? '—' : pipelineOpen() }}</span>
          <span class="kpi-label">Open pipeline</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>celebration</mat-icon>
          <span class="kpi-value">{{ pipelineConverted() === null ? '—' : pipelineConverted() }}</span>
          <span class="kpi-label">Converted 30d</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>warning</mat-icon>
          <span class="kpi-value">{{ stuckCount() === null ? '—' : stuckCount() }}</span>
          <span class="kpi-label">Stuck follow-ups</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>percent</mat-icon>
          <span class="kpi-value">{{ conversionLabel() }}</span>
          <span class="kpi-label">Conversion rate</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>school</mat-icon>
          <span class="kpi-value">{{ trainingLabel() }}</span>
          <span class="kpi-label">Training readiness</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>flag</mat-icon>
          <span class="kpi-value">{{ goalsLabel() }}</span>
          <span class="kpi-label">Goals complete</span>
        </mat-card-content></mat-card>
      </div>

      <div class="split">
        <div class="dp-card panel">
          <h4>My pipeline by stage</h4>
          @if (stageRows().length > 0) {
            <ul class="stages">
              @for (s of stageRows(); track s.stage) {
                <li>
                  <span>{{ s.stage }}</span>
                  <div class="bar-track"><div class="bar-fill" [style.width.%]="s.pct"></div></div>
                  <strong>{{ s.count }}</strong>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">{{ pipelineLoaded() ? 'No pipeline leads yet — add your first contact.' : 'Pipeline unavailable — retry.' }}</p>
          }
          @if (teamDepth() !== null) {
            <p class="muted">Team depth {{ teamDepth() }} generations
              @if (perLevel().length > 0) {
                · L1 {{ perLevel()[0] ?? 0 }}@if (perLevel().length > 1) { · L2 {{ perLevel()[1] ?? 0 }} }@if (perLevel().length > 2) { · L3 {{ perLevel()[2] ?? 0 }} }
              }
            </p>
          }
        </div>

        <div class="dp-card panel">
          <h4>Health + forecast</h4>
          @if (team(); as t) {
            <p class="health-line">
              Health <strong>{{ t.health.score ?? '—' }}</strong>
              @if (t.forecast) {
                <span class="muted"> · +{{ t.forecast.recruitsNext | number }} recruits, {{ t.forecast.teamVolumeNext | number }} shop volume at pace</span>
              }
            </p>
            @if (t.health.recommendations.length > 0) {
              <ul class="reco">
                @for (r of t.health.recommendations.slice(0, 3); track r) {
                  <li><mat-icon>lightbulb</mat-icon><span>{{ r }}</span></li>
                }
              </ul>
            } @else {
              <p class="muted">No warnings — keep the rhythm.</p>
            }
          } @else {
            <p class="muted">{{ teamLoaded() ? 'No team data yet.' : 'Health unavailable — retry.' }}</p>
          }
          @if (readiness(); as r) {
            <p class="muted">Training: {{ r.label }} · {{ r.percent }}% complete</p>
            <mat-progress-bar mode="determinate" [value]="r.percent" aria-label="Progress" />
          }
        </div>
      </div>

      <h4>My next moves</h4>
      @if (nextSteps().length > 0) {
        <ul class="steps">
          @for (s of nextSteps(); track s.title) {
            <li class="dp-card step">
              <mat-icon>{{ s.icon }}</mat-icon>
              <div>
                <strong>{{ s.title }}</strong>
                <p class="muted">{{ s.detail }}</p>
              </div>
              <span class="spacer"></span>
              <a mat-button [routerLink]="s.link">{{ s.cta }}</a>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">Everything is on track — pick one income action and do it today.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page h4 { margin: 0.5em 0 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .head-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .head-actions button, .head-actions a { min-height: 44px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75em; }
    .kpi-grid mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi-grid mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
    @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
    .panel { padding: 1em; }
    .panel h4 { margin: 0 0 0.5em; }
    .stages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .stages li { display: grid; grid-template-columns: 110px 1fr 40px; gap: 0.6em; align-items: center; font-size: 0.9em; }
    .bar-track { height: 10px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--ms-primary); min-width: 2px; }
    .health-line { margin: 0 0 0.5em; }
    .reco { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .reco li { display: flex; gap: 0.5em; align-items: flex-start; }
    .reco mat-icon { color: var(--ms-primary-strong); font-size: 20px; height: 20px; width: 20px; }
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .step { display: flex; gap: 0.7em; align-items: center; padding: 0.8em 1em; flex-wrap: wrap; }
    .step mat-icon { color: var(--ms-primary-strong); }
    .step p { margin: 0.15em 0 0; }
    .spacer { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
    button, a[mat-button] { min-height: 44px; }
  `],
})
export class MyBusinessComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly leads = inject(LeadPipelineService);
  private readonly network = inject(NetworkService);
  private readonly training = inject(TrainingService);
  private readonly goalsApi = inject(GoalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadedOnce = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<DashboardOverview | null>(null);
  protected readonly pipeline = signal<ProspectLead[]>([]);
  protected readonly pipelineLoaded = signal(false);
  protected readonly stuckCount = signal<number | null>(null);
  protected readonly teamDepth = signal<number | null>(null);
  protected readonly perLevel = signal<number[]>([]);
  protected readonly joinedAt = signal<string[]>([]);
  protected readonly readiness = signal<Readiness | null>(null);
  protected readonly readinessLoaded = signal(false);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly goalsLoaded = signal(false);

  protected readonly team = computed(() => this.overview()?.team ?? null);
  protected readonly teamLoaded = computed(() => !!this.overview());

  protected readonly teamVolumeLabel = computed(() => {
    const t = this.team();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    const d = t.teamVolume.deltaPct;
    const arrow = d === null || d === undefined ? '' : d >= 0 ? ` (+${Math.round(d)}%)` : ` (${Math.round(d)}%)`;
    return `${Math.round(t.teamVolume.current).toLocaleString()}${arrow}`;
  });

  protected readonly personalVolumeLabel = computed(() => {
    const t = this.team();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    return `${Math.round(t.personalVolume.total).toLocaleString()} · ${t.personalVolume.orders} orders`;
  });

  protected readonly activeTeamLabel = computed(() => {
    const t = this.team();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    return `${t.downline.active}/${t.downline.total}`;
  });

  protected readonly recruitsIn = (days: number): number => {
    const cutoff = Date.now() - days * 86400000;
    return this.joinedAt().filter((d) => {
      const ms = new Date(d).getTime();
      return Number.isFinite(ms) && ms >= cutoff;
    }).length;
  };

  protected readonly velocityLabel = computed(() => {
    if (!this.teamLoaded() && this.joinedAt().length === 0) return '—';
    return `${this.recruitsIn(7)} / ${this.recruitsIn(30)}`;
  });

  protected readonly pipelineOpen = computed(() => {
    if (!this.pipelineLoaded()) return null;
    return this.pipeline().filter((l) => !['Converted', 'Closed'].includes(String(l.status?.stage ?? ''))).length;
  });

  protected readonly pipelineConverted = computed(() => {
    if (!this.pipelineLoaded()) return null;
    return this.pipeline().filter((l) => String(l.status?.stage ?? '') === 'Converted').length;
  });

  protected readonly conversionLabel = computed(() => {
    if (!this.pipelineLoaded()) return '—';
    const rows = this.pipeline();
    const converted = rows.filter((l) => String(l.status?.stage ?? '') === 'Converted').length;
    const closed = rows.filter((l) => String(l.status?.stage ?? '') === 'Closed').length;
    const entered = rows.length - closed;
    if (entered <= 0) return rows.length ? `0% (0/${rows.length})` : '—';
    return `${Math.round((converted / entered) * 100)}% (${converted}/${entered})`;
  });

  protected readonly stageRows = computed(() => {
    const rows = this.pipeline();
    if (!rows.length) return [];
    const counts = new Map<string, number>();
    for (const l of rows) {
      const s = String(l.status?.stage ?? 'New');
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].map(([stage, count]) => ({ stage, count, pct: Math.max(2, Math.round((count / max) * 100)) }));
  });

  protected readonly trainingLabel = computed(() => {
    const r = this.readiness();
    if (!r) return this.readinessLoaded() ? 'No data' : '—';
    return `${r.percent}%`;
  });

  protected readonly goalsBehind = computed(() =>
    this.goals().filter((g) => !g.progress.complete && !g.progress.onTrack),
  );

  protected readonly goalsLabel = computed(() => {
    if (!this.goalsLoaded()) return '—';
    const list = this.goals();
    if (list.length === 0) return 'No goals';
    return `${list.filter((g) => g.progress.complete).length}/${list.length}`;
  });

  protected readonly nextSteps = computed<Step[]>(() => {
    const steps: Step[] = [];
    const stuck = this.stuckCount() ?? 0;
    const open = this.pipelineOpen() ?? 0;
    const behind = this.goalsBehind();
    const r = this.readiness();
    const t = this.team();
    if (stuck > 0) {
      steps.push({ icon: 'warning', title: `Work ${stuck} stuck follow-up${stuck === 1 ? '' : 's'}`, detail: 'Past attention threshold — touch them today.', link: '/dashboard/prospects/pipeline', cta: 'Open pipeline' });
    }
    if (behind.length > 0) {
      const first = behind[0];
      steps.push({ icon: 'flag', title: `${behind.length} goal${behind.length === 1 ? '' : 's'} behind pace`, detail: `"${first.title}" — ${first.progress.current} of ${first.target}, ${first.progress.daysLeft}d left.`, link: '/dashboard/goals', cta: 'Open goals' });
    }
    if (r && r.percent < 100) {
      steps.push({ icon: 'school', title: `Training at ${r.percent}%`, detail: r.missing[0] ? `${r.missing[0].label} — ${r.missing[0].action}` : 'Finish your current course in the Academy.', link: '/dashboard/training', cta: 'Open Academy' });
    }
    if (open > 0 && stuck === 0) {
      steps.push({ icon: 'trending_up', title: `Review ${open} open lead${open === 1 ? '' : 's'}`, detail: 'Advance one stage or book the next chat.', link: '/dashboard/prospects/pipeline', cta: 'Open pipeline' });
    }
    if (t && t.downline.total > 0 && (t.downline.activationRate ?? 1) < 0.5) {
      const pct = Math.round((t.downline.activationRate ?? 0) * 100);
      steps.push({ icon: 'group', title: `Only ${pct}% of team active`, detail: 'Re-engage dormant members this week.', link: '/dashboard/mentorship/team/activation', cta: 'Activation' });
    }
    if (this.recruitsIn(7) === 0 && this.teamLoaded()) {
      steps.push({ icon: 'person_add', title: 'No recruits in 7 days', detail: 'Share your public page and book one showcase.', link: '/dashboard/settings/landing-page', cta: 'Share page' });
    }
    if (this.pipelineLoaded() && this.pipeline().length === 0) {
      steps.push({ icon: 'assignment', title: 'Empty pipeline', detail: 'Add your first contact to start building.', link: '/dashboard/tools/contacts/new', cta: 'Add someone' });
    }
    return steps.slice(0, 5);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    const me = this.auth.currentUser()?.id;
    if (!me) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    const id = String(me);
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.analytics.overview(30).pipe(catchError(() => of(null))),
      pipeline: this.leads.listByPartner(id, { limit: 200 }).pipe(catchError(() => of(null))),
      stuck: this.leads.stuck(id).pipe(catchError(() => of(null))),
      tree: this.network.tree(id, 3).pipe(catchError(() => of(null))),
      readiness: this.training.readiness().pipe(catchError(() => of(null))),
      goals: this.goalsApi.mine().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, pipeline, stuck, tree, readiness, goals }) => {
          this.overview.set((overview as { data?: DashboardOverview } | null)?.data ?? null);
          const rows = (pipeline as { data?: ProspectLead[] } | null)?.data;
          this.pipeline.set(Array.isArray(rows) ? rows : []);
          this.pipelineLoaded.set(Array.isArray(rows));
          const stuckRows = (stuck as { data?: unknown[] } | null)?.data;
          this.stuckCount.set(Array.isArray(stuckRows) ? stuckRows.length : null);
          const meta = (tree as { data?: { meta?: { depth?: number; perLevel?: number[] } } } | null)?.data?.meta;
          this.teamDepth.set(typeof meta?.depth === 'number' ? meta.depth : null);
          this.perLevel.set(Array.isArray(meta?.perLevel) ? meta.perLevel : []);
          this.joinedAt.set(flattenJoinedAt((tree as { data?: { tree?: NetworkNode } } | null)?.data?.tree));
          const rd = (readiness as { data?: Readiness } | null)?.data ?? null;
          this.readiness.set(rd);
          this.readinessLoaded.set(!!readiness);
          const goalRows = (goals as { data?: Goal[] } | null)?.data;
          this.goals.set(Array.isArray(goalRows) ? goalRows : []);
          this.goalsLoaded.set(Array.isArray(goalRows));
          this.loadedOnce.set(true);
          if (!overview && !pipeline && !stuck && !tree && !readiness && !goals) {
            this.error.set('Could not load business data.');
          }
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}

function flattenJoinedAt(root: NetworkNode | undefined): string[] {
  if (!root) return [];
  const out: string[] = [];
  const walk = (n: NetworkNode): void => {
    for (const c of n.children ?? []) {
      if (c.joinedAt) out.push(c.joinedAt);
      walk(c);
    }
  };
  walk(root);
  return out.filter(Boolean);
}
