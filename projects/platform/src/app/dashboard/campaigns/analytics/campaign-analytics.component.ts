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
      <header class="analytics-hero">
        <span class="hero-glow hero-glow--violet" aria-hidden="true"></span>
        <span class="hero-glow hero-glow--teal" aria-hidden="true"></span>

        <div class="hero-main">
          <span class="hero-eyebrow"><mat-icon>insights</mat-icon> Campaign analytics</span>
          <div class="hero-title-row">
            <h2>{{ campaign.name }}</h2>
            <span class="hero-status" [attr.data-status]="campaign.status">{{ campaign.status }}</span>
          </div>
          <p class="hero-meta">
            {{ campaign.category || 'General growth' }}
            <span aria-hidden="true">·</span>
            Started {{ campaign.flight.startAt | date:'mediumDate' }}
            @if (campaign.flight.endAt) {
              <span aria-hidden="true">·</span> Ends {{ campaign.flight.endAt | date:'mediumDate' }}
            }
          </p>
        </div>

        <div class="hero-actions">
          <button type="button" class="copy-btn" (click)="copyLink()" [disabled]="!campaign.trackingUrl">
            <mat-icon>{{ copied() ? 'check' : 'link' }}</mat-icon>
            {{ copied() ? 'Copied' : 'Copy campaign link' }}
          </button>
          <button type="button" class="icon-btn" (click)="close()" aria-label="Close campaign analytics">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </header>

      <div class="analytics-body">
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
          <section class="stats-grid" aria-label="Campaign summary">
            <article class="stat-card">
              <span class="stat-icon stat-icon--violet"><mat-icon>group_add</mat-icon></span>
              <div class="stat-copy">
                <span class="stat-label">Joined</span>
                <strong>{{ a.summary.signups }}</strong>
                <small>from your campaign link</small>
              </div>
            </article>

            <article class="stat-card">
              <span class="stat-icon stat-icon--blue"><mat-icon>verified_user</mat-icon></span>
              <div class="stat-copy">
                <span class="stat-label">Activated</span>
                <strong>{{ a.summary.activated }}</strong>
                <small>{{ a.summary.activationRate }}% of joined</small>
                <span class="stat-bar" aria-hidden="true">
                  <i [style.width.%]="progress(a.summary.activationRate)"></i>
                </span>
              </div>
            </article>

            <article class="stat-card">
              <span class="stat-icon stat-icon--green"><mat-icon>bolt</mat-icon></span>
              <div class="stat-copy">
                <span class="stat-label">Active after 7 days</span>
                <strong>
                  @if (a.summary.eligible7 > 0) {
                    {{ a.summary.retained7 }} <em>of {{ a.summary.eligible7 }}</em>
                  } @else {
                    —
                  }
                </strong>
                <small>{{ retentionLabel(a.summary.eligible7, a.summary.retentionRate) }}</small>
                <span class="stat-bar stat-bar--success" aria-hidden="true">
                  <i [style.width.%]="progress(a.summary.retentionRate)"></i>
                </span>
              </div>
            </article>

            <article class="stat-card">
              <span class="stat-icon stat-icon--amber"><mat-icon>schedule</mat-icon></span>
              <div class="stat-copy">
                <span class="stat-label">Last signup</span>
                <strong class="stat-date">
                  {{ a.summary.lastSignupAt ? (a.summary.lastSignupAt | date:'mediumDate') : '—' }}
                </strong>
                <small>
                  {{ a.summary.lastActivityAt
                    ? 'Last active ' + (a.summary.lastActivityAt | date:'mediumDate')
                    : 'No activity yet' }}
                </small>
              </div>
            </article>
          </section>

          @if (insight(); as text) {
            <aside class="insight-card" aria-live="polite">
              <span class="insight-icon"><mat-icon>auto_awesome</mat-icon></span>
              <p>{{ text }}</p>
            </aside>
          }

          @if (a.summary.signups === 0) {
            <div class="empty">
              <span class="empty-icon"><mat-icon>rocket_launch</mat-icon></span>
              <h3>Your campaign is ready for its first signal</h3>
              <p>Share your campaign link to start measuring joins, activations and 7-day activity.</p>
              <button mat-stroked-button type="button" (click)="copyLink()" [disabled]="!campaign.trackingUrl">
                <mat-icon>link</mat-icon> Copy campaign link
              </button>
            </div>
          } @else {
            <section class="charts-grid">
              <article class="chart-card">
                <div class="chart-head">
                  <div>
                    <span class="chart-eyebrow">Conversion</span>
                    <h3>Journey so far</h3>
                  </div>
                  <span class="chart-badge">All time</span>
                </div>
                <div echarts [options]="journeyChart()" class="chart chart--journey" role="img"
                  aria-label="Joined, activated and active-after-seven-days campaign chart"></div>
              </article>

              <article class="chart-card">
                <div class="chart-head">
                  <div>
                    <span class="chart-eyebrow">Momentum</span>
                    <h3>Daily activity</h3>
                  </div>
                  <span class="chart-badge">Last {{ a.windowDays }} days</span>
                </div>
                <div echarts [options]="trendChart()" class="chart chart--trend" role="img"
                  aria-label="Daily campaign signups and activations chart"></div>
              </article>
            </section>
          }

          <footer class="data-note">
            <mat-icon>verified</mat-icon>
            <p>
              Counts update automatically from your campaign link.
              <strong>Active after 7 days</strong> means an activated member was seen at or after day 7.
              @if (campaign.trackingCode) {
                <span class="tracking-code">Tracking code: {{ campaign.trackingCode }}</span>
              }
            </p>
          </footer>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .analytics-dialog {
      max-height: 90vh;
      overflow-y: auto;
      background: var(--ms-canvas);
      scrollbar-width: thin;
      scrollbar-color: var(--ms-line-strong) transparent;
    }
    .analytics-hero {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      padding: 28px 30px;
      overflow: hidden;
      color: #fff;
      background: linear-gradient(125deg, #121024 0%, #24204b 54%, #4c5bd4 100%);
    }
    .hero-glow {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(2px);
    }
    .hero-glow--violet {
      width: 280px;
      height: 280px;
      right: 12%;
      top: -190px;
      background: radial-gradient(circle, rgba(129, 140, 248, .55), transparent 68%);
    }
    .hero-glow--teal {
      width: 220px;
      height: 220px;
      left: 38%;
      bottom: -170px;
      background: radial-gradient(circle, rgba(20, 184, 166, .32), transparent 70%);
    }
    .hero-main, .hero-actions { position: relative; z-index: 1; }
    .hero-main { min-width: 0; }
    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
      color: rgba(255, 255, 255, .68);
      font-size: .7rem;
      font-weight: 800;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .hero-eyebrow mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .hero-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .hero-title-row h2 {
      margin: 0;
      color: #fff;
      font-size: clamp(1.45rem, 2.4vw, 2rem);
      line-height: 1.12;
      letter-spacing: -.02em;
      overflow-wrap: anywhere;
    }
    .hero-status {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(255, 255, 255, .18);
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, .1);
      color: rgba(255, 255, 255, .82);
      font-size: .7rem;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .hero-status[data-status="Active"] {
      border-color: rgba(110, 231, 183, .36);
      background: rgba(16, 185, 129, .16);
      color: #a7f3d0;
    }
    .hero-status[data-status="Paused"] {
      border-color: rgba(252, 211, 77, .36);
      background: rgba(245, 158, 11, .16);
      color: #fde68a;
    }
    .hero-status[data-status="Cancelled"] {
      border-color: rgba(252, 165, 165, .36);
      background: rgba(239, 68, 68, .16);
      color: #fecaca;
    }
    .hero-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 10px 0 0;
      color: rgba(255, 255, 255, .62);
      font-size: .84rem;
    }
    .hero-actions { display: flex; align-items: center; gap: 8px; flex: none; }
    .copy-btn, .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 1px solid rgba(255, 255, 255, .24);
      border-radius: 999px;
      background: rgba(255, 255, 255, .08);
      color: #fff;
      font: inherit;
      font-size: .8rem;
      font-weight: 700;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
    }
    .copy-btn { padding: 9px 14px; }
    .copy-btn mat-icon, .icon-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .copy-btn:hover:not(:disabled), .icon-btn:hover { background: rgba(255, 255, 255, .15); border-color: rgba(255, 255, 255, .4); }
    .copy-btn:disabled { opacity: .45; cursor: default; }
    .icon-btn { width: 38px; height: 38px; padding: 0; }
    .copy-btn:focus-visible, .icon-btn:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }

    .analytics-body { display: grid; gap: 18px; padding: 22px 30px 28px; }
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid var(--ms-danger);
      border-radius: 14px;
      background: var(--ms-surface);
    }
    .alert p { margin: 0; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .stat-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 0;
      padding: 18px;
      border: 1px solid var(--ms-line);
      border-radius: 16px;
      background: var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }
    .stat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 11px;
    }
    .stat-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .stat-icon--violet { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .stat-icon--blue { background: var(--ms-info-soft); color: var(--ms-info); }
    .stat-icon--green { background: var(--ms-success-soft); color: var(--ms-success); }
    .stat-icon--amber { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .stat-copy { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
    .stat-label {
      color: var(--ms-text-muted);
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .stat-copy strong { font-size: 1.6rem; line-height: 1.12; font-variant-numeric: tabular-nums; }
    .stat-copy strong.stat-date {
      max-width: 100%;
      overflow: hidden;
      font-size: .95rem;
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stat-copy strong em { color: var(--ms-text-muted); font-size: .8rem; font-style: normal; font-weight: 700; }
    .stat-copy small { color: var(--ms-text-muted); font-size: .76rem; line-height: 1.35; }
    .stat-bar {
      display: block;
      height: 5px;
      margin-top: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--ms-primary-soft);
    }
    .stat-bar i { display: block; height: 100%; border-radius: inherit; background: var(--ms-primary); transition: width .45s ease; }
    .stat-bar--success { background: var(--ms-success-soft); }
    .stat-bar--success i { background: var(--ms-success); }

    .insight-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, var(--ms-primary) 22%, var(--ms-line));
      border-radius: 14px;
      background: linear-gradient(120deg, var(--ms-primary-soft), color-mix(in srgb, var(--ms-surface) 82%, var(--ms-primary-soft)));
    }
    .insight-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: var(--ms-primary);
      color: #fff;
    }
    .insight-icon mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .insight-card p { margin: 4px 0 0; color: var(--ms-text); font-size: .86rem; line-height: 1.5; }

    .charts-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 16px; }
    .chart-card {
      min-width: 0;
      padding: 18px 18px 12px;
      border: 1px solid var(--ms-line);
      border-radius: 16px;
      background: var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }
    .chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    .chart-head h3 { margin: 2px 0 0; font-size: 1rem; }
    .chart-eyebrow {
      color: var(--ms-text-muted);
      font-size: .64rem;
      font-weight: 800;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    .chart-badge {
      flex: none;
      border: 1px solid var(--ms-line);
      border-radius: 999px;
      padding: 4px 9px;
      background: var(--ms-canvas);
      color: var(--ms-text-muted);
      font-size: .68rem;
      font-weight: 700;
    }
    .chart { width: 100%; height: 268px; }

    .empty {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 38px 20px;
      border: 1px dashed var(--ms-line-strong);
      border-radius: 16px;
      background: var(--ms-surface);
      text-align: center;
    }
    .empty-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }
    .empty-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .empty h3 { margin: 4px 0 0; }
    .empty p { margin: 0 0 8px; max-width: 38em; color: var(--ms-text-muted); line-height: 1.5; }

    .data-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 0 2px;
      color: var(--ms-text-muted);
      font-size: .76rem;
      line-height: 1.5;
    }
    .data-note mat-icon { flex: none; font-size: 16px; width: 16px; height: 16px; margin-top: 1px; color: var(--ms-success); }
    .data-note p { margin: 0; }
    .data-note strong { color: var(--ms-text); }
    .tracking-code { display: inline-block; margin-left: 4px; color: var(--ms-text-soft); }

    @media (max-width: 860px) {
      .analytics-hero { padding: 24px 20px; }
      .analytics-body { padding: 18px 20px 22px; }
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .charts-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 560px) {
      .analytics-hero { align-items: flex-start; flex-direction: column; gap: 16px; padding: 22px 18px; }
      .hero-actions { width: 100%; justify-content: space-between; }
      .copy-btn { flex: 1; justify-content: center; }
      .analytics-body { padding: 16px 18px 20px; }
      .stats-grid { grid-template-columns: minmax(0, 1fr); }
      .stat-card { padding: 16px; }
      .chart { height: 230px; }
      .chart-card { padding: 16px 14px 10px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .stat-bar i { transition: none; }
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
  protected readonly copied = signal(false);

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

  protected copyLink(): void {
    const url = String(this.campaign.trackingUrl ?? '').trim();
    if (!url || !globalThis.navigator?.clipboard?.writeText) return;
    globalThis.navigator.clipboard.writeText(url).then(
      () => {
        this.copied.set(true);
        globalThis.setTimeout(() => this.copied.set(false), 2000);
      },
      () => null,
    );
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected progress(value: number | null): number {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  protected retentionLabel(eligible7: number, retentionRate: number | null): string {
    if (eligible7 === 0) return 'Cohort not old enough yet';
    if (retentionRate === null) return '—';
    return `${retentionRate}% retained`;
  }

  protected readonly insight = computed(() => {
    const summary = this.analytics()?.summary;
    if (!summary || summary.signups === 0) return null;
    if (summary.eligible7 === 0) {
      return `${summary.activationRate}% of joins have activated. 7-day retention unlocks when the first cohort matures.`;
    }
    if (summary.retentionRate !== null && summary.retentionRate >= 60) {
      return `Strong start: ${summary.retentionRate}% of the measurable cohort is still active after day 7.`;
    }
    if (summary.retentionRate !== null && summary.retentionRate < 40) {
      return `${summary.activationRate}% of joins activate, but only ${summary.retentionRate}% are still active after day 7. A quick check-in can help.`;
    }
    return `${summary.activationRate}% of joins activate; ${summary.retentionRate ?? 0}% of the measurable cohort is still active after day 7.`;
  });

  protected readonly journeyChart = computed<EChartsCoreOption>(() => {
    const summary = this.analytics()?.summary;
    const p = this.theme.palette();
    const axis = this.theme.axis();
    if (!summary) return {};
    return {
      ...this.theme.base(),
      grid: { left: 4, right: 42, top: 10, bottom: 4, containLabel: true },
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
        barWidth: 20,
        showBackground: true,
        backgroundStyle: { color: p.goldSoft, borderRadius: 999 },
        data: [
          { value: summary.signups, itemStyle: { color: p.ramp[1], borderRadius: 999 } },
          { value: summary.activated, itemStyle: { color: p.gold, borderRadius: 999 } },
          { value: summary.retained7, itemStyle: { color: p.success, borderRadius: 999 } },
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
      grid: { left: 4, right: 12, top: 38, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: p.line } } },
      legend: { top: 0, left: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: p.muted } },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: rows.map((row) => row.date.slice(5)),
        ...axis,
        axisTick: { show: false },
        axisLabel: {
          color: p.muted,
          fontSize: 11,
          interval: Math.max(Math.floor(rows.length / 6), 0),
        },
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
          smooth: 0.35,
          showSymbol: false,
          data: rows.map((row) => row.signups),
          lineStyle: { width: 2.5, color: p.gold },
          itemStyle: { color: p.gold },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(102, 126, 234, .28)' },
                { offset: 1, color: 'rgba(102, 126, 234, 0)' },
              ],
            },
          },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Activated',
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          data: rows.map((row) => row.activated),
          lineStyle: { width: 2.5, color: p.success },
          itemStyle: { color: p.success },
          emphasis: { focus: 'series' },
        },
      ],
    };
  });
}
