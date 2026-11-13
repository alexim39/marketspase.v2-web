import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgxEchartsDirective } from 'ngx-echarts';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { CampaignAnalytics, GrowthCampaign } from '../../../core/campaigns/campaigns.models';
import { ChartThemeService } from '../../../core/charts/chart-theme.service';
import type { EChartsCoreOption } from '../../../core/charts/echarts-setup';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Owner-scoped campaign results. Opened from a campaign card so the partner
 * never needs a separate analytics destination or any setup step.
 */
@Component({
  selector: 'async-campaign-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    NgxEchartsDirective,
  ],
  template: `
    <div class="analytics-dialog">
      <header class="analytics-head">
        <div class="analytics-title">
          <p class="eyebrow">Campaign analytics</p>
          <h2>{{ campaign.name }}</h2>
          <p class="muted">
            {{ campaign.category || 'General growth' }} · started {{ campaign.flight.startAt | date:'mediumDate' }}
            @if (campaign.flight.endAt) { · ends {{ campaign.flight.endAt | date:'mediumDate' }} }
          </p>
        </div>
        <button mat-icon-button type="button" (click)="close()" aria-label="Close campaign analytics">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading campaign analytics" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="load()">Retry</button>
        </div>
      }

      @if (analytics(); as a) {
        <div class="stat-grid">
          <article class="stat">
            <span>Joined</span>
            <strong>{{ a.summary.signups }}</strong>
            <small>from your campaign link</small>
          </article>
          <article class="stat">
            <span>Activated</span>
            <strong>{{ a.summary.activated }}</strong>
            <small>{{ a.summary.activationRate }}% of joined</small>
          </article>
          <article class="stat">
            <span>Active after 7 days</span>
            <strong>
              @if (a.summary.eligible7 > 0) {
                {{ a.summary.retained7 }} <em>of {{ a.summary.eligible7 }}</em>
              } @else {
                —
              }
            </strong>
            <small>{{ retentionLabel(a.summary.eligible7, a.summary.retentionRate) }}</small>
          </article>
          <article class="stat">
            <span>Last signup</span>
            <strong>{{ a.summary.lastSignupAt ? (a.summary.lastSignupAt | date:'mediumDate') : '—' }}</strong>
            <small>
              {{ a.summary.lastActivityAt
                ? 'Last active ' + (a.summary.lastActivityAt | date:'mediumDate')
                : 'No activity yet' }}
            </small>
          </article>
        </div>

        @if (a.summary.signups === 0) {
          <div class="empty">
            <mat-icon>insights</mat-icon>
            <h3>No signups yet</h3>
            <p>Share your campaign link to start measuring joins, activations and 7-day activity.</p>
          </div>
        } @else {
          <div class="chart-grid">
            <section class="chart-card">
              <div class="chart-head">
                <h3>Journey so far</h3>
                <span class="muted small">All time</span>
              </div>
              <div echarts [options]="journeyChart()" class="chart" role="img"
                aria-label="Joined, activated and active-after-seven-days campaign chart"></div>
            </section>
            <section class="chart-card">
              <div class="chart-head">
                <h3>Last {{ a.windowDays }} days</h3>
                <span class="muted small">Joined vs activated</span>
              </div>
              <div echarts [options]="trendChart()" class="chart" role="img"
                aria-label="Daily campaign signups and activations chart"></div>
            </section>
          </div>
        }

        <p class="footnote">
          Counts update automatically from your campaign link. “Active after 7 days” means an activated member
          was seen at or after day 7.
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .analytics-dialog { display: grid; gap: 14px; max-height: 86vh; overflow-y: auto; padding-right: 4px; }
    .analytics-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .analytics-title { min-width: 0; }
    .analytics-title h2 { margin: 2px 0 4px; font-size: 1.45rem; overflow-wrap: anywhere; }
    .analytics-title p { margin: 0; }
    .eyebrow { margin: 0; color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: .08em; font-size: .7rem; font-weight: 800; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: .8rem; }
    .alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid var(--ms-danger); border-radius: 12px; background: var(--ms-surface); }
    .alert p { margin: 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .stat { border: 1px solid var(--ms-line); border-radius: 12px; padding: 12px 14px; background: var(--ms-surface); min-width: 0; }
    .stat > span { display: block; color: var(--ms-text-muted); font-size: .72rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
    .stat strong { display: block; margin: 5px 0 2px; font-size: 1.55rem; line-height: 1.1; }
    .stat strong em { color: var(--ms-text-muted); font-size: .85rem; font-style: normal; font-weight: 700; }
    .stat small { color: var(--ms-text-muted); font-size: .78rem; }
    .chart-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 12px; }
    .chart-card { border: 1px solid var(--ms-line); border-radius: 12px; padding: 12px; background: var(--ms-surface); min-width: 0; }
    .chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
    .chart-head h3 { margin: 0; font-size: .95rem; }
    .chart { width: 100%; height: 250px; }
    .empty { display: grid; justify-items: center; text-align: center; gap: 6px; padding: 30px 16px; border: 1px dashed var(--ms-line); border-radius: 12px; }
    .empty h3 { margin: 2px 0 0; }
    .empty p { margin: 0; color: var(--ms-text-muted); max-width: 40em; }
    .footnote { margin: 0 2px; color: var(--ms-text-muted); font-size: .78rem; line-height: 1.45; }
    @media (max-width: 760px) {
      .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .chart-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 460px) {
      .stat-grid { grid-template-columns: minmax(0, 1fr); }
      .chart { height: 220px; }
    }
  `],
})
export class CampaignAnalyticsDialogComponent implements OnInit {
  private readonly campaigns = inject(CampaignsService);
  private readonly theme = inject(ChartThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<CampaignAnalyticsDialogComponent>);

  readonly campaign: GrowthCampaign = inject(MAT_DIALOG_DATA);

  protected readonly analytics = signal<CampaignAnalytics | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.campaigns.analytics(this.campaign.id, 30).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (res) => this.analytics.set(res.data ?? null),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected retentionLabel(eligible7: number, retentionRate: number | null): string {
    if (eligible7 === 0) return 'Cohort not old enough yet';
    if (retentionRate === null) return '—';
    return `${retentionRate}% retained`;
  }

  protected readonly journeyChart = computed<EChartsCoreOption>(() => {
    const summary = this.analytics()?.summary;
    const p = this.theme.palette();
    const axis = this.theme.axis();
    if (!summary) return {};
    return {
      ...this.theme.base(),
      grid: { left: 4, right: 34, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        minInterval: 1,
        ...axis,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: ['Joined', 'Activated', 'Active after 7 days'],
        ...axis,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [{
        type: 'bar',
        barWidth: 18,
        data: [
          { value: summary.signups, itemStyle: { color: p.ramp[1], borderRadius: [0, 999, 999, 0] } },
          { value: summary.activated, itemStyle: { color: p.gold, borderRadius: [0, 999, 999, 0] } },
          { value: summary.retained7, itemStyle: { color: p.success, borderRadius: [0, 999, 999, 0] } },
        ],
        label: { show: true, position: 'right', color: p.text, fontWeight: 700 },
      }],
    };
  });

  protected readonly trendChart = computed<EChartsCoreOption>(() => {
    const rows = this.analytics()?.series ?? [];
    const p = this.theme.palette();
    const axis = this.theme.axis();
    return {
      ...this.theme.base(),
      grid: { left: 4, right: 12, top: 34, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, right: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: p.muted } },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: rows.map((row) => row.date.slice(5)),
        ...axis,
        axisTick: { show: false },
        axisLabel: { color: p.muted, interval: Math.max(Math.floor(rows.length / 6), 0) },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        ...axis,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Joined',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: rows.map((row) => row.signups),
          lineStyle: { width: 2, color: p.gold },
          itemStyle: { color: p.gold },
          areaStyle: { color: p.gold, opacity: 0.08 },
        },
        {
          name: 'Activated',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: rows.map((row) => row.activated),
          lineStyle: { width: 2, color: p.success },
          itemStyle: { color: p.success },
        },
      ],
    };
  });
}
