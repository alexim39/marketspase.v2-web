import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
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
    MatProgressBarModule, MatSelectModule, NgxEchartsDirective, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Insights</span>
      </div>
    </section>

    <section class="insights-page">
      <div class="page-head">
        <div>
          <h2>Insights</h2>
          <p class="subtitle">What to do today — and the numbers behind it.</p>
        </div>
        <mat-form-field appearance="outline" class="window-field">
          <mat-label>Window</mat-label>
          <mat-select [value]="days()" (selectionChange)="setDays($event.value)">
            <mat-option [value]="7">Last 7 days</mat-option>
            <mat-option [value]="30">Last 30 days</mat-option>
            <mat-option [value]="90">Last 90 days</mat-option>
          </mat-select>
        </mat-form-field>
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

      <h3>Daily action center</h3>
      @if (actions().length > 0) {
        <ul class="action-list">
          @for (action of actions(); track action.id) {
            <li class="action-item" [class.action-item--high]="action.priority === 'high'">
                <span [class]="priorityClass(action.priority)"
                >{{ priority(action.priority).label }}</span>
              <div class="action-body">
                <strong>{{ action.title }}</strong>
                <span class="muted">{{ action.detail }} · {{ action.category }}</span>
              </div>
              @if (action.link) {
                <a mat-button [routerLink]="action.link">Open</a>
              }
            </li>
          }
        </ul>
      } @else if (!loading() && !error()) {
        <p class="empty">Nothing urgent — enjoy the quiet, or go prospecting.</p>
      }

      @if (goalSummary(); as gs) {
        <p class="goals-strip">
          <a routerLink="/dashboard/goals">Goals:</a>
          {{ gs.complete }}/{{ gs.total }} complete
          @if (gs.behind > 0) {
            · <strong class="behind">{{ gs.behind }} behind pace</strong>
          }
        </p>
      }

      <h3>Recruitment funnel <span class="muted">({{ funnel()?.days }}-day cohort)</span></h3>      @if (funnel(); as f) {
        @if (f.entered > 0 && funnelChart(); as chart) {
          <div echarts [options]="chart" class="chart chart--funnel" role="img" aria-label="Recruitment funnel chart"></div>
        } @else if (f.entered === 0) {
          <p class="empty">No prospects entered in this window — widen the range or go prospecting.</p>
        }
        <div class="funnel-summary">
          <p class="muted">
            {{ f.entered | number }} entered · {{ f.converted | number }} converted ·
            @if (f.overallRate !== null) { {{ f.overallRate }}% overall · }
            {{ f.lost | number }} lost
          </p>
        </div>
      }

      <h3>Team health</h3>
      @if (team(); as src) {
        <p class="muted source-note">
          {{ src.source === 'snapshot' ? 'Overnight snapshot · refreshes nightly' : 'Computed live just now' }}
        </p>
      }
      @if (team(); as t) {
        @if (healthGauge(); as gauge) {
          <div echarts [options]="gauge" class="chart chart--gauge" role="img" aria-label="Team health score gauge"></div>
        }
        <div class="stat-grid">
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.health.score ?? '—' }}</span>
              <span class="stat-label">Health score</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.recruits.current | number }}</span>
              <span class="stat-label">Recruits ({{ delta(t.recruits.deltaPct) }})</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.teamVolume.current | number }}</span>
              <span class="stat-label">Shop volume — team ({{ delta(t.teamVolume.deltaPct) }})</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.downline.active | number }}/{{ t.downline.total | number }}</span>
              <span class="stat-label">Members active</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.conversions | number }}</span>
              <span class="stat-label">Conversions</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="stat-value">{{ t.goals.complete | number }}/{{ t.goals.total | number }}</span>
              <span class="stat-label">Goals complete</span>
            </mat-card-content>
          </mat-card>
          @if (t.forecast) {
            <mat-card>
              <mat-card-content>
                <span class="stat-value">+{{ t.forecast.recruitsNext | number }}</span>
                <span class="stat-label">Recruits next (at pace)</span>
              </mat-card-content>
            </mat-card>
            <mat-card>
              <mat-card-content>
                <span class="stat-value">{{ t.forecast.teamVolumeNext | number }}</span>
                <span class="stat-label">Shop volume next (at pace)</span>
              </mat-card-content>
            </mat-card>
          }
        </div>
        @if (t.health.recommendations.length > 0) {
          <ul class="reco-list">
            @for (reco of t.health.recommendations; track reco) {
              <li><mat-icon>lightbulb</mat-icon><span>{{ reco }}</span></li>
            }
          </ul>
        }
      }
      @if (bench(); as b) {
        <h3>Leadership bench</h3>
        <p class="muted">{{ b.leaders | number }} leaders in {{ b.total | number }} downline · {{ b.pendingNominations | number }} nominations pending</p>
      }

      <h3>Take your data</h3>
      <div class="exports">
        <button mat-button [color]="exportFormat() === 'csv' ? 'primary' : undefined" (click)="exportFormat.set('csv')">CSV</button>
        <button mat-button [color]="exportFormat() === 'xlsx' ? 'primary' : undefined" (click)="exportFormat.set('xlsx')">Excel</button>
        @for (item of exportKinds; track item.kind) {
          <button
            mat-button
            (click)="export(item.kind)"
            [disabled]="downloading() !== null"
          >
            <mat-icon>download</mat-icon>
            {{ downloading() === downloadKey(item.kind) ? 'Preparing…' : item.label }}
          </button>
        }
        <button mat-button (click)="print()">
          <mat-icon>print</mat-icon>
          Print / PDF
        </button>
        @if (exportError(); as err) {
          <span class="error" role="alert">{{ err }}</span>
        }
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .insights-page { display: flex; flex-direction: column; gap: 1em; }
    .insights-page h3 { margin: 0.5em 0 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .window-field { width: 180px; }
    .action-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .action-item { display: flex; gap: 0.9em; align-items: center; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.7em 1em; }
    .action-item--high { border-left: 4px solid var(--ms-error); }
    .action-body { flex: 1; display: flex; flex-direction: column; gap: 0.15em; }
    .chart { width: 100%; }
    .chart--funnel { height: 320px; }
    .chart--gauge { height: 220px; }
    .funnel-summary p { margin: 0.25em 0 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .stat-grid mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .stat-value { font-size: 1.5em; font-weight: 700; }
    .stat-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .reco-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .reco-list li { display: flex; gap: 0.5em; align-items: flex-start; color: var(--ms-text); }
    .reco-list mat-icon { color: var(--ms-primary-strong); font-size: 20px; height: 20px; width: 20px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .source-note { margin: -0.5em 0 0; }
    .exports { display: flex; gap: 0.25em; flex-wrap: wrap; align-items: center; }
    .exports button, .action-item a { min-height: 44px; }
    .goals-strip { margin: 0; }
    .goals-strip a { text-decoration: none; font-weight: 600; }
    .behind { color: var(--ms-error); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
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
    { kind: 'reports-mine', label: 'My reports' },
    { kind: 'reports-team', label: 'Team reports' },
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
