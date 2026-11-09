import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { NetworkService } from '../../../../network/tree/network.service';
import { NetworkNode } from '../../../../network/tree/network.models';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoardItem, ProspectLead } from '../../../prospects/lead-pipeline/lead.models';
import { TrainingService } from '../../../../../core/training/training.service';
import { TeamMemberDetail } from '../../../../../core/training/training.models';
import { AnalyticsService } from '../../../../../core/analytics/analytics.service';
import { TeamAnalytics } from '../../../../../core/analytics/analytics.models';
import { GoalService } from '../../../../../core/goals/goal.service';
import { Goal } from '../../../../../core/goals/goal.models';
import { ApiError, userError } from '../../../../../core/http/api-error';

/**
 * @title Business KPI — downline business health for one partner.
 *
 * Answers for an upline: how big is this partner's business, how fast it
 * grows, how well it converts and learns — plus the ranked next step.
 * Phase 2 adds velocity (recruits 7/30d from tree join dates), conversion
 * rate + lost (from pipeline), training compliance (upline-scoped team
 * member endpoint).
 * Session-owned money/goals analytics are deliberately excluded — no
 * per-member backend scope exists, so showing them would be wrong data.
 * Every slice is fail-soft ("—" + retry); every action works.
 */
@Component({
  selector: 'async-partner-business-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="dp-card kpi-section" aria-label="Business KPI">
      <div class="kpi-head">
        <div>
          <h3>Business KPI — {{ partnerName() }}</h3>
          <p class="muted">Live snapshot of this partner's downline business + what to do next as upline.</p>
        </div>
        <button mat-button (click)="reload()" [disabled]="loading()">Refresh</button>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="2" label="business KPI" [showHeader]="false" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      <div class="kpi-grid">
        <mat-card><mat-card-content>
          <mat-icon>groups</mat-icon>
          <span class="kpi-value">{{ directCount() }}</span>
          <span class="kpi-label">Direct partners</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>account_tree</mat-icon>
          <span class="kpi-value">{{ teamTotal() === null ? '—' : teamTotal() }}</span>
          <span class="kpi-label">Total team (3 generations)</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>trending_up</mat-icon>
          <span class="kpi-value">{{ pipelineOpen() === null ? '—' : pipelineOpen() }}</span>
          <span class="kpi-label">Open pipeline</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>celebration</mat-icon>
          <span class="kpi-value">{{ pipelineConverted() === null ? '—' : pipelineConverted() }}</span>
          <span class="kpi-label">Converted</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>warning</mat-icon>
          <span class="kpi-value">{{ stuckCount() === null ? '—' : stuckCount() }}</span>
          <span class="kpi-label">Stuck follow-ups</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>checklist</mat-icon>
          <span class="kpi-value">{{ activationTrainingLabel() }}</span>
          <span class="kpi-label">Training gates</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>speed</mat-icon>
          <span class="kpi-value">{{ velocityLabel() }}</span>
          <span class="kpi-label">Recruits 7d / 30d</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>percent</mat-icon>
          <span class="kpi-value">{{ conversionLabel() }}</span>
          <span class="kpi-label">Conversion rate</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>school</mat-icon>
          <span class="kpi-value">{{ trainingLabel() }}</span>
          <span class="kpi-label">Training · certified</span>
        </mat-card-content></mat-card>
        <mat-card><mat-card-content>
          <mat-icon>schedule</mat-icon>
          <span class="kpi-value">{{ daysSinceJoinedLabel() }}</span>
          <span class="kpi-label">Since joined</span>
        </mat-card-content></mat-card>
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
          <mat-icon>flag</mat-icon>
          <span class="kpi-value">{{ goalsLabel() }}</span>
          <span class="kpi-label">Goals complete</span>
        </mat-card-content></mat-card>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      <div class="split">
        <div class="panel">
          <h4>Pipeline by stage</h4>
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
            <p class="muted">{{ pipelineLoaded() ? 'No pipeline leads yet.' : 'Pipeline unavailable — retry.' }}</p>
          }
          @if (teamDepth() !== null) {
            <p class="muted">Team depth {{ teamDepth() }} generations
              @if (perLevel().length > 0) {
                · L1 {{ perLevel()[0] ?? 0 }}@if (perLevel().length > 1) { · L2 {{ perLevel()[1] ?? 0 }} }@if (perLevel().length > 2) { · L3 {{ perLevel()[2] ?? 0 }} }
              }
            </p>
          }
        </div>

        <div class="panel">
          <h4>Activation</h4>
          @if (activation(); as a) {
            <div class="chips">
              <mat-chip highlighted>IPO: {{ a.ipoDone ? 'done' : 'pending' }}</mat-chip>
              <mat-chip highlighted>QSG: {{ a.qsgDone ? 'done' : 'pending' }}</mat-chip>
              <mat-chip highlighted>SMO: {{ a.smoDone ? 'done' : 'pending' }}</mat-chip>
            </div>
            <p class="next"><strong>Next:</strong> {{ a.nextAction }}</p>
          } @else {
            <p class="muted">No activation record yet — onboarding hasn't started.</p>
          }
          <h4 class="sub">Training detail</h4>
          @if (training(); as t) {
            <p class="muted">{{ t.overallPercent }}% overall · {{ t.certifiedCount }} certified</p>
            <ul class="stages">
              @for (c of t.courses.slice(0, 4); track c.courseId) {
                <li>
                  <span>{{ c.title }}</span>
                  <div class="bar-track"><div class="bar-fill" [style.width.%]="c.percent"></div></div>
                  <strong>{{ c.percent }}%</strong>
                </li>
              }
            </ul>
            <button mat-button (click)="nudge()" [disabled]="nudging()">Nudge to train</button>
          } @else {
            <p class="muted">{{ trainingLoaded() ? 'No training record yet.' : 'Training unavailable — retry.' }}</p>
          }
        </div>
      </div>

      <h4>Next steps for you as upline</h4>
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
        <p class="muted">Healthy — nothing urgent. Check back after their next touches.</p>
      }
    </section>
  `,
  styles: [`
    .kpi-section { padding: 1em; display: flex; flex-direction: column; gap: 1em; margin-top: 1em; }
    .kpi-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .kpi-head h3 { margin: 0; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75em; }
    .kpi-grid mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi-grid mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
    @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
    .panel h4 { margin: 0 0 0.5em; }
    .stages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .stages li { display: grid; grid-template-columns: 110px 1fr 40px; gap: 0.6em; align-items: center; font-size: 0.9em; }
    .bar-track { height: 10px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--ms-primary); min-width: 2px; }
    .chips { display: flex; gap: 0.4em; flex-wrap: wrap; margin-bottom: 0.5em; }
    .next { margin: 0; }
    .sub { margin: 1em 0 0.4em; }
    .notice { color: var(--ms-success); }
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .step { display: flex; gap: 0.7em; align-items: center; padding: 0.8em 1em; flex-wrap: wrap; }
    .step mat-icon { color: var(--ms-primary-strong); }
    .step p { margin: 0.15em 0 0; }
    .spacer { flex: 1; }
    button, a[mat-button] { min-height: 44px; }
  `],
})
export class PartnerBusinessKpiComponent implements OnInit {
  @Input() myPartner!: PartnerInterface;
  @Input() myPartnerPartners: PartnerInterface[] = [];
  @Input() supportInfo: ActivationBoardItem | null = null;

  private readonly network = inject(NetworkService);
  private readonly leads = inject(LeadPipelineService);
  private readonly trainingSvc = inject(TrainingService);
  private readonly analytics = inject(AnalyticsService);
  private readonly goalsApi = inject(GoalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly teamTotal = signal<number | null>(null);
  protected readonly teamDepth = signal<number | null>(null);
  protected readonly perLevel = signal<number[]>([]);
  protected readonly teamJoinedAt = signal<string[]>([]);
  protected readonly pipeline = signal<ProspectLead[]>([]);
  protected readonly pipelineLoaded = signal(false);
  protected readonly stuckCount = signal<number | null>(null);
  protected readonly training = signal<TeamMemberDetail | null>(null);
  protected readonly trainingLoaded = signal(false);
  protected readonly nudging = signal(false);
  protected readonly teamStats = signal<TeamAnalytics | null>(null);
  protected readonly teamLoaded = signal(false);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly goalsLoaded = signal(false);

  protected readonly directCount = computed(() => this.myPartnerPartners?.length ?? 0);
  protected readonly activation = computed(() => this.supportInfo);
  protected readonly activationTrainingLabel = computed(() => {
    const a = this.supportInfo;
    if (!a) return '—';
    return [a.ipoDone, a.qsgDone, a.smoDone].filter(Boolean).length + '/3';
  });
  protected readonly pipelineOpen = computed(() => {
    if (!this.pipelineLoaded()) return null;
    return this.pipeline().filter((l) => !['Converted', 'Closed'].includes(String(l.status?.stage ?? ''))).length;
  });
  protected readonly pipelineConverted = computed(() => {
    if (!this.pipelineLoaded()) return null;
    return this.pipeline().filter((l) => String(l.status?.stage ?? '') === 'Converted').length;
  });
  protected readonly pipelineLost = computed(() => {
    if (!this.pipelineLoaded()) return null;
    return this.pipeline().filter((l) => String(l.status?.stage ?? '') === 'Closed').length;
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
  protected readonly velocityLabel = computed(() => {
    if (this.teamTotal() === null && this.teamJoinedAt().length === 0) return '—';
    return `${this.recruits7d()} / ${this.recruits30d()}`;
  });
  protected readonly trainingLabel = computed(() => {
    const t = this.training();
    if (!t) return this.trainingLoaded() ? 'No record' : '—';
    return `${t.overallPercent}% · ${t.certifiedCount}`;
  });
  protected readonly daysSinceJoinedLabel = computed(() => {
    const raw = (this.myPartner as { createdAt?: unknown })?.createdAt;
    const ms = raw ? new Date(String(raw)).getTime() : NaN;
    if (!Number.isFinite(ms)) return '—';
    const days = Math.max(0, Math.floor((Date.now() - ms) / 86400000));
    return days === 0 ? 'today' : `${days}d`;
  });
  protected readonly teamVolumeLabel = computed(() => {
    const t = this.teamStats();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    const d = t.teamVolume.deltaPct;
    const arrow = d === null || d === undefined ? '' : d >= 0 ? ` (+${Math.round(d)}%)` : ` (${Math.round(d)}%)`;
    return `${Math.round(t.teamVolume.current).toLocaleString()}${arrow}`;
  });
  protected readonly personalVolumeLabel = computed(() => {
    const t = this.teamStats();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    return `${Math.round(t.personalVolume.total).toLocaleString()} · ${t.personalVolume.orders} orders`;
  });
  protected readonly activeTeamLabel = computed(() => {
    const t = this.teamStats();
    if (!t) return this.teamLoaded() ? 'No data' : '—';
    return `${t.downline.active}/${t.downline.total}`;
  });
  protected readonly goalsBehind = computed(() =>
    this.goals().filter((g) => !g.progress.complete && !g.progress.onTrack),
  );
  protected readonly goalsLabel = computed(() => {
    if (!this.goalsLoaded()) return '—';
    const list = this.goals();
    if (list.length === 0) return 'No goals';
    const done = list.filter((g) => g.progress.complete).length;
    return `${done}/${list.length}`;
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

  protected readonly nextSteps = computed(() => {
    const steps: Array<{ icon: string; title: string; detail: string; link: string; cta: string }> = [];
    const id = String((this.myPartner as { _id?: unknown })?._id ?? '');
    const direct = this.directCount();
    const a = this.supportInfo;
    const stuck = this.stuckCount() ?? 0;
    const open = this.pipelineOpen() ?? 0;
    if (direct === 0) {
      steps.push({ icon: 'person_add', title: 'Help them land their first partner', detail: 'No direct recruits yet — review the activation board and plan the first conversations together.', link: '/dashboard/mentorship/team/activation', cta: 'Open activation' });
    }
    const active = this.teamStats()?.downline ?? null;
    if (this.teamLoaded() && active && active.total > 0 && (active.activationRate ?? 1) < 0.5) {
      const pct = Math.round((active.activationRate ?? 0) * 100);
      steps.push({ icon: 'group', title: `Only ${pct}% of team active`, detail: `${active.inactive} of ${active.total} dormant — plan re-engagement calls together.`, link: '/dashboard/network/tree', cta: 'View tree' });
    }
    if (stuck > 0) {
      steps.push({ icon: 'warning', title: `Clear ${stuck} stuck follow-up${stuck === 1 ? '' : 's'}`, detail: 'Past stage attention threshold — call through them together this week.', link: `/dashboard/mentorship/partners/my-partners/contacts/${id}`, cta: 'View contacts' });
    } else if (open > 0) {
      steps.push({ icon: 'trending_up', title: `Work ${open} open pipeline lead${open === 1 ? '' : 's'}`, detail: 'Review stages together and agree the next touch for each.', link: `/dashboard/mentorship/partners/my-partners/contacts/${id}`, cta: 'View contacts' });
    }
    return steps.slice(0, 4);
  });

  private recruits7d(): number {
    return this.recruitsIn(7);
  }

  private recruits30d(): number {
    return this.recruitsIn(30);
  }

  private recruitsIn(days: number): number {
    const cutoff = Date.now() - days * 86400000;
    return this.teamJoinedAt().filter((d) => {
      const ms = new Date(d).getTime();
      return Number.isFinite(ms) && ms >= cutoff;
    }).length;
  }

  protected partnerName(): string {
    return `${this.myPartner?.name ?? ''} ${this.myPartner?.surname ?? ''}`.trim() || this.myPartner?.username || 'partner';
  }

  /** Nudge this partner to train — upline-scoped, functional. */
  protected nudge(): void {
    const id = String((this.myPartner as { _id?: unknown })?._id ?? '');
    if (!id || this.nudging()) return;
    this.nudging.set(true);
    this.notice.set(null);
    this.trainingSvc
      .nudge(id, 'Your upline is cheering you on — finish your next course this week.')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.nudging.set(false);
          this.notice.set(res.message ?? 'Nudge sent — they get a training reminder.');
        },
        error: (err: ApiError) => {
          this.nudging.set(false);
          this.error.set(userError(err));
        },
      });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    const id = String((this.myPartner as { _id?: unknown })?._id ?? '');
    if (!id) {
      this.error.set('Partner not loaded yet.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      tree: this.network.tree(id, 3).pipe(catchError(() => of(null))),
      pipeline: this.leads.listByPartner(id, { limit: 200 }).pipe(catchError(() => of(null))),
      stuck: this.leads.stuck(id).pipe(catchError(() => of(null))),
      training: this.trainingSvc.teamMember(id).pipe(catchError(() => of(null))),
      team: this.analytics.team(30, id).pipe(catchError(() => of(null))),
      goals: this.goalsApi.byPartner(id).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tree, pipeline, stuck, training, team, goals }) => {
          const meta = (tree as { data?: { meta?: { total?: number; depth?: number; perLevel?: number[] } } } | null)?.data?.meta;
          this.teamTotal.set(typeof meta?.total === 'number' ? meta.total : null);
          this.teamDepth.set(typeof meta?.depth === 'number' ? meta.depth : null);
          this.perLevel.set(Array.isArray(meta?.perLevel) ? meta.perLevel : []);
          this.teamJoinedAt.set(flattenJoinedAt((tree as { data?: { tree?: NetworkNode } } | null)?.data?.tree, id));
          const rows = (pipeline as { data?: ProspectLead[] } | null)?.data;
          this.pipeline.set(Array.isArray(rows) ? rows : []);
          this.pipelineLoaded.set(Array.isArray(rows));
          const stuckRows = (stuck as { data?: unknown[] } | null)?.data;
          this.stuckCount.set(Array.isArray(stuckRows) ? stuckRows.length : null);
          const t = (training as { data?: TeamMemberDetail } | null)?.data ?? null;
          this.training.set(t);
          this.trainingLoaded.set(!!training);
          const teamData = (team as { data?: TeamAnalytics } | null)?.data ?? null;
          this.teamStats.set(teamData);
          this.teamLoaded.set(!!team);
          const goalRows = (goals as { data?: Goal[] } | null)?.data;
          this.goals.set(Array.isArray(goalRows) ? goalRows : []);
          this.goalsLoaded.set(Array.isArray(goalRows));
          if (!tree && !pipeline && !stuck && !training && !team && !goals) this.error.set('Could not load business data.');
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}

function flattenJoinedAt(root: NetworkNode | undefined, excludeId: string): string[] {
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
