import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { ExportFormat, ExportKind, ExportService } from '../../../core/analytics/export.service';
import { ChartThemeService } from '../../../core/charts/chart-theme.service';
import type { EChartsCoreOption } from '../../../core/charts/echarts-setup';
import { ActionPriority, DailyAction, Funnel, TeamAnalytics } from '../../../core/analytics/analytics.models';
import { ApiError } from '../../../core/http/api-error';

const PRIORITY_META: Record<ActionPriority, { label: string; color: string; text: string }> = {
  high: { label: 'Act now', color: '#ffcdd2', text: '#b71c1c' },
  medium: { label: 'Soon', color: '#ffecb3', text: '#7a5c00' },
  low: { label: 'FYI', color: '#e3f2fd', text: '#0d47a1' },
};

/**
 * @title Insights — action center, recruitment funnel, team health.
 *
 * Answers "what should I do today?" then shows the numbers behind it.
 * All metrics are server-computed; this page only renders.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-insights-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule,
    MatSelectModule, NgxEchartsDirective, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Insights</span>
      </div>
    </section>

    <section class="insights-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Insights · Business health</p>
          <h1>Your business, at a glance</h1>
          <p class="subtitle">What to do today, the funnel behind it, and the team signals that tell you whether the business is getting healthier.</p>
        </div>
        <div class="head-actions">
          <mat-form-field appearance="outline" class="window-field" subscriptSizing="dynamic">
            <mat-label>Window</mat-label>
            <mat-select [value]="days()" (selectionChange)="setDays($event.value)">
              <mat-option [value]="7">Last 7 days</mat-option>
              <mat-option [value]="30">Last 30 days</mat-option>
              <mat-option [value]="90">Last 90 days</mat-option>
            </mat-select>
          </mat-form-field>
          <a mat-stroked-button routerLink="/dashboard/insights/my-business"><mat-icon>business_center</mat-icon> My business</a>
          <a mat-stroked-button routerLink="/dashboard/insights/downloads"><mat-icon>download</mat-icon> Reports</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="insights" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="reload()">Retry</button></div>
      }

      @if (!loading() && !error()) {
        <section class="summary-strip" aria-label="Business summary">
          <div class="summary-card"><span class="summary-icon"><mat-icon>health_and_safety</mat-icon></span><div><strong>{{ team()?.health?.score ?? '—' }}</strong><span>Health score</span><small>Out of 100</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>groups</mat-icon></span><div><strong>{{ team()?.downline?.active ?? 0 }}/{{ team()?.downline?.total ?? 0 }}</strong><span>Active members</span><small>Team activity</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--info"><mat-icon>swap_horiz</mat-icon></span><div><strong>{{ team()?.conversions ?? 0 }}</strong><span>Conversions</span><small>In this window</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--warn"><mat-icon>flag</mat-icon></span><div><strong>{{ goalSummary()?.complete ?? 0 }}/{{ goalSummary()?.total ?? 0 }}</strong><span>Goals complete</span><small>{{ goalSummary()?.behind ?? 0 }} behind pace</small></div></div>
        </section>

        <div class="insights-grid">
          <section class="panel actions-panel" aria-label="Daily action center">
            <div class="panel-head">
              <div><p class="eyebrow">Today</p><h2>Daily action center</h2></div>
              <span class="pill">{{ actions().length }} action{{ actions().length === 1 ? '' : 's' }}</span>
            </div>
            @if (actions().length > 0) {
              <ul class="action-list">
                @for (action of actions(); track action.id) {
                  <li class="action-item" [class.action-item--high]="action.priority === 'high'">
                    <span [class]="priorityClass(action.priority)">{{ priority(action.priority).label }}</span>
                    <div class="action-body">
                      <strong>{{ action.title }}</strong>
                      <span class="muted">{{ action.detail }} · {{ action.category }}</span>
                    </div>
                    @if (action.link) {
                      <a mat-stroked-button [routerLink]="action.link">Open</a>
                    }
                  </li>
                }
              </ul>
            } @else {
              <div class="empty"><mat-icon>task_alt</mat-icon><p>Nothing urgent — enjoy the quiet or go prospecting.</p></div>
            }
            @if (goalSummary(); as gs) {
              <a class="goals-strip" routerLink="/dashboard/goals">
                <mat-icon>flag</mat-icon>
                <span>{{ gs.complete }}/{{ gs.total }} goals complete@if (gs.behind > 0) { · <strong>{{ gs.behind }} behind pace</strong> }</span>
                <mat-icon>arrow_forward</mat-icon>
              </a>
            }
          </section>

          <section class="panel funnel-panel" aria-label="Recruitment funnel">
            <div class="panel-head">
              <div><p class="eyebrow">Pipeline</p><h2>Recruitment funnel</h2></div>
              <span class="pill">{{ funnel()?.days }}-day cohort</span>
            </div>
            @if (funnel(); as f) {
              @if (f.entered > 0 && funnelChart(); as chart) {
                <div echarts [options]="chart" class="chart chart--funnel" role="img" aria-label="Recruitment funnel chart"></div>
              } @else if (f.entered === 0) {
                <div class="empty"><mat-icon>person_search</mat-icon><p>No prospects entered in this window — widen the range or go prospecting.</p></div>
              }
              <div class="funnel-summary">
                <span><strong>{{ f.entered | number }}</strong> entered</span>
                <span><strong>{{ f.converted | number }}</strong> converted</span>
                <span><strong>{{ f.overallRate ?? '—' }}{{ f.overallRate !== null ? '%' : '' }}</strong> overall</span>
                <span><strong>{{ f.lost | number }}</strong> lost</span>
              </div>
            }
          </section>
        </div>

        <section class="panel health-panel" aria-label="Team health">
          <div class="panel-head">
            <div><p class="eyebrow">Team</p><h2>Team health</h2></div>
            <span class="pill">{{ team()?.source === 'snapshot' ? 'Nightly snapshot' : 'Live now' }}</span>
          </div>
          <div class="health-layout">
            <div class="gauge-wrap">
              @if (healthGauge(); as gauge) {
                <div echarts [options]="gauge" class="chart chart--gauge" role="img" aria-label="Team health score gauge"></div>
              } @else {
                <div class="empty"><mat-icon>monitoring</mat-icon><p>Not enough team activity to score health yet.</p></div>
              }
            </div>
            <div class="stat-grid">
              <div class="stat"><span>Recruits</span><strong>{{ team()?.recruits?.current | number }}</strong><small>{{ delta(team()?.recruits?.deltaPct ?? 0) }}</small></div>
              <div class="stat"><span>Team volume</span><strong>{{ team()?.teamVolume?.current | number }}</strong><small>{{ delta(team()?.teamVolume?.deltaPct ?? 0) }}</small></div>
              <div class="stat"><span>Conversions</span><strong>{{ team()?.conversions | number }}</strong><small>This window</small></div>
              <div class="stat"><span>Goals complete</span><strong>{{ team()?.goals?.complete | number }}/{{ team()?.goals?.total | number }}</strong><small>{{ team()?.goals?.rate ?? 0 }}%</small></div>
              @if (team()?.forecast; as forecast) {
                <div class="stat"><span>Recruits next</span><strong>+{{ forecast.recruitsNext | number }}</strong><small>At current pace</small></div>
                <div class="stat"><span>Team volume next</span><strong>{{ forecast.teamVolumeNext | number }}</strong><small>At current pace</small></div>
              }
            </div>
          </div>
          @if (team()?.health?.recommendations; as recommendations) {
            @if (recommendations.length) {
              <ul class="reco-list">
                @for (reco of recommendations; track reco) {
                  <li><mat-icon>lightbulb</mat-icon><span>{{ reco }}</span></li>
                }
              </ul>
            }
          }
        </section>

        <div class="lower-grid">
          <section class="panel bench-panel" aria-label="Leadership bench">
            <div class="panel-head"><div><p class="eyebrow">Leadership</p><h2>Leadership bench</h2></div></div>
            <p class="bench-line"><strong>{{ bench()?.leaders ?? 0 }}</strong> leaders in <strong>{{ bench()?.total ?? 0 }}</strong> downline.</p>
            @if ((bench()?.pendingConfirmations ?? 0) > 0) {
              <p class="muted">{{ bench()?.pendingConfirmations }} confirmation{{ bench()?.pendingConfirmations === 1 ? '' : 's' }} pending.</p>
            }
            <a mat-stroked-button routerLink="/dashboard/network/tree">Open team tree</a>
          </section>

          <section class="panel exports-panel" aria-label="Take your data">
            <div class="panel-head"><div><p class="eyebrow">Records</p><h2>Take your data</h2></div></div>
            <div class="format-row" role="group" aria-label="Export format">
              <button mat-button type="button" [color]="exportFormat() === 'csv' ? 'primary' : undefined" (click)="exportFormat.set('csv')">CSV</button>
              <button mat-button type="button" [color]="exportFormat() === 'xlsx' ? 'primary' : undefined" (click)="exportFormat.set('xlsx')">Excel</button>
            </div>
            <div class="export-buttons">
              @for (item of exportKinds; track item.kind) {
                <button mat-stroked-button type="button" (click)="export(item.kind)" [disabled]="downloading() !== null">
                  <mat-icon>download</mat-icon>
                  {{ downloading() === downloadKey(item.kind) ? 'Preparing…' : item.label }}
                </button>
              }
              <button mat-stroked-button type="button" (click)="print()"><mat-icon>print</mat-icon> Print / PDF</button>
            </div>
            @if (exportError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </section>
        </div>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .insights-page { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 6px; }
    .window-field { width: 170px; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-icon { width: 40px; height: 40px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 1px; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.6875rem; }

    .insights-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 16px; align-items: start; }
    .panel { padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.125rem; }
    .pill { padding: 4px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
    .action-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .action-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); flex-wrap: wrap; }
    .action-item--high { border-left: 3px solid var(--ms-error); }
    .action-body { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 1px; }
    .action-body strong { font-size: 0.875rem; }
    .action-body .muted { font-size: 0.75rem; }
    .action-item a { min-height: 38px; }
    .goals-strip { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); color: var(--ms-primary-strong); text-decoration: none; font-size: 0.8125rem; font-weight: 600; }
    .goals-strip span { flex: 1; }
    .goals-strip mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .chart { width: 100%; }
    .chart--funnel { height: 300px; }
    .chart--gauge { height: 190px; }
    .funnel-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
    .funnel-summary span { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; }
    .funnel-summary strong { color: var(--ms-text); font-size: 0.9375rem; font-variant-numeric: tabular-nums; }

    .health-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: center; }
    .gauge-wrap { min-width: 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stat { display: flex; flex-direction: column; gap: 1px; padding: 12px 16px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .stat span { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat strong { font-size: 1.125rem; font-variant-numeric: tabular-nums; }
    .stat small { color: var(--ms-text-muted); font-size: 0.6875rem; }
    .reco-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .reco-list li { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); color: var(--ms-text); font-size: 0.8125rem; line-height: 1.5; }
    .reco-list mat-icon { color: var(--ms-primary-strong); font-size: 18px; width: 18px; height: 18px; flex: none; }

    .lower-grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 16px; }
    .bench-line { margin: 0 0 4px; font-size: 1rem; }
    .bench-line strong { font-family: var(--ms-font-display); font-size: 1.5rem; }
    .bench-panel a { margin-top: 12px; align-self: flex-start; min-height: 40px; }
    .format-row { display: flex; gap: 4px; margin-bottom: 8px; }
    .export-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .export-buttons button { min-height: 40px; }
    .export-buttons mat-icon { margin-right: 4px; }
    .muted { color: var(--ms-text-muted); font-size: 0.8125rem; }
    .error { color: var(--ms-error); font-size: 0.8125rem; }
    .empty { display: flex; align-items: center; gap: 8px; padding: 16px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); color: var(--ms-text-muted); }
    .empty mat-icon { color: var(--ms-success); }
    .empty p { margin: 0; font-size: 0.8125rem; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .behind { color: var(--ms-error); }
    @media (max-width: 1000px) { .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .insights-grid, .lower-grid { grid-template-columns: minmax(0, 1fr); } .health-layout { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 700px) { .panel { padding: 16px; } .summary-strip { grid-template-columns: minmax(0, 1fr); } .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .funnel-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`],
})
export class InsightsOverviewComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly exporter = inject(ExportService);
  private readonly charts = inject(ChartThemeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal<string | null>(null);
  protected readonly exportFormat = signal<ExportFormat>('csv');
  protected readonly exportError = signal<string | null>(null);
  protected readonly days = signal(30);
  protected readonly actions = signal<DailyAction[]>([]);
  protected readonly funnel = signal<Funnel | null>(null);
  protected readonly team = signal<TeamAnalytics | null>(null);
  protected readonly goalSummary = signal<{ total: number; complete: number; behind: number } | null>(null);
  protected readonly bench = signal<import('../../../core/analytics/analytics.models').BenchAnalytics | null>(null);

  /** Funnel chart — rebuilt on data or light/dark toggle. */
  protected readonly funnelChart = computed<EChartsCoreOption | null>(() => {
    const f = this.funnel();
    if (!f || f.entered <= 0) return null;
    const p = this.charts.palette();
    return {
      ...this.charts.base(),
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number | string }) => {
          const step = f.steps.find((s) => s.stage === params.name);
          const rate = step?.cumulativeRate;
          return `${params.name}: ${params.value}${rate !== null && rate !== undefined ? ` (${rate}%)` : ''}`;
        },
      },
      series: [
        {
          type: 'funnel',
          left: '8%',
          width: '84%',
          label: { show: true, position: 'inside', formatter: '{b}\n{c}', color: '#fff' },
          itemStyle: { borderColor: p.line, borderWidth: 1 },
          emphasis: { label: { fontSize: 14 } },
          data: f.steps.map((s, i) => ({
            name: s.stage,
            value: s.count,
            itemStyle: { color: p.ramp[i % p.ramp.length] },
          })),
        },
      ],
    };
  });

  /** Health gauge — null when there is nothing to score yet. */
  protected readonly healthGauge = computed<EChartsCoreOption | null>(() => {
    const score = this.team()?.health.score;
    if (score === null || score === undefined) return null;
    const p = this.charts.palette();
    const color = score >= 70 ? p.success : score >= 40 ? p.gold : p.error;
    return {
      ...this.charts.base(),
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          radius: '100%',
          center: ['50%', '85%'],
          progress: { show: true, width: 14, itemStyle: { color } },
          axisLine: { lineStyle: { width: 14, color: [[1, p.line]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: true, offsetCenter: [0, '18%'], color: p.muted, fontSize: 12 },
          detail: { valueAnimation: true, offsetCenter: [0, '-12%'], color: p.text, fontSize: 30, fontWeight: 700, formatter: '{value}' },
          data: [{ value: score, name: 'Team health' }],
        },
      ],
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  protected setDays(days: number): void {
    this.days.set(days);
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    // Single aggregation call — actions, funnel, team, goals in one round trip.
    this.analytics
      .overview(this.days())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actions.set(res.data?.actions?.actions ?? []);
          this.funnel.set(res.data?.funnel ?? null);
          this.team.set(res.data?.team ?? null);
          const g = res.data?.goals;
          this.goalSummary.set(g ? { total: g.total, complete: g.complete, behind: g.behind } : null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    this.analytics
      .bench()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.bench.set(res.data ?? null),
        error: () => {},
      });
  }

  protected priority(p: ActionPriority): { label: string; color: string; text: string } {
    return PRIORITY_META[p] ?? PRIORITY_META['low'];
  }

  /** Plain-span priority pill — mat-chip repaints internals from theme tokens. */
  protected priorityClass(p: ActionPriority): string {
    if (p === 'high') return 'dp-status dp-status--bad';
    if (p === 'medium') return 'dp-status dp-status--warn';
    return 'dp-status dp-status--info';
  }

  protected delta(pct: number): string {
    return `${pct > 0 ? '+' : ''}${pct}% vs prior`;
  }

  protected readonly exportKinds: Array<{ kind: ExportKind; label: string }> = [
    { kind: 'team', label: 'Team roster' },
    { kind: 'pipeline', label: 'Pipeline' },
    { kind: 'commissions', label: 'Growth commissions' },
    { kind: 'community', label: 'Community stats' },
  ];

  protected downloadKey(kind: ExportKind): string {
    return `${kind}.${this.exportFormat()}`;
  }

  protected export(kind: ExportKind): void {
    this.downloading.set(this.downloadKey(kind));
    this.exportError.set(null);
    this.exporter
      .download(kind, this.exportFormat())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.downloading.set(null),
        error: (err: ApiError) => {
          this.downloading.set(null);
          this.exportError.set(err.message);
        },
      });
  }

  protected print(): void {
    window.print();
  }
}
