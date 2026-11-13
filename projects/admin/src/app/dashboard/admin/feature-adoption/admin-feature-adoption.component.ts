import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ApiError, userError } from '../../../core/http/api-error';
import { FeatureAnalyticsService } from '../../../core/analytics/feature-analytics.service';
import { FeatureAdoption } from '../../../core/analytics/feature-analytics.models';

@Component({
  selector: 'async-admin-feature-adoption',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, PageSkeletonComponent],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Growth · Product intelligence</p>
          <h1>Feature adoption</h1>
          <p class="subtitle">Do the new growth tools change behaviour? Launch path, Ora sends, retention outreach, ROI engagement, trust exports and time to first commission.</p>
        </div>
        <div class="periods" role="group" aria-label="Period">
          @for (days of periods; track days) {
            <button mat-button type="button" [class.active]="period() === days" (click)="setPeriod(days)">{{ days }}d</button>
          }
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="4" label="feature adoption" [showHeader]="false" />
      } @else if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="load()">Retry</button></div>
      } @else if (data(); as d) {
        <section class="kpi-grid">
          <div class="kpi"><span class="kpi-icon"><mat-icon>bolt</mat-icon></span><div><strong>{{ d.events.total | number }}</strong><span>Product events</span><small>{{ d.events.partners }} unique partners</small></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--ok"><mat-icon>route</mat-icon></span><div><strong>{{ d.launch.completionRate === null ? '—' : d.launch.completionRate + '%' }}</strong><span>Launch path completion</span><small>{{ d.launch.completions }} of {{ d.launch.views }} views</small></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--info"><mat-icon>send</mat-icon></span><div><strong>{{ d.ora.sendApprovalRate === null ? '—' : d.ora.sendApprovalRate + '%' }}</strong><span>Ora send approval</span><small>{{ d.ora.send.executed }} sent · {{ d.ora.send.skipped }} skipped</small></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--warn"><mat-icon>repeat</mat-icon></span><div><strong>{{ d.retention.conversionRate === null ? '—' : d.retention.conversionRate + '%' }}</strong><span>Reorder conversion</span><small>{{ d.retention.convertedAfterOutreach }} of {{ d.retention.outreach }} outreach</small></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--info"><mat-icon>query_stats</mat-icon></span><div><strong>{{ d.roi.tabViews }}</strong><span>ROI tab views</span><small>{{ d.roi.analyticsOpens }} analytics opens</small></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--ok"><mat-icon>shield</mat-icon></span><div><strong>{{ d.trust.exports }}</strong><span>Trust data exports</span><small>Self-service records</small></div></div>
        </section>

        <div class="grid">
          <section class="panel">
            <h2>Launch path</h2>
            <div class="rows">
              <div><span>Views</span><strong>{{ d.launch.views }}</strong></div>
              <div><span>Completed views</span><strong>{{ d.launch.completions }}</strong></div>
              <div><span>Next-action clicks</span><strong>{{ d.launch.nextActions }}</strong></div>
              <div><span>Completion rate</span><strong>{{ d.launch.completionRate === null ? '—' : d.launch.completionRate + '%' }}</strong></div>
            </div>
            <div class="callout">
              <span>Time to first commission</span>
              <strong>{{ d.launch.timeToFirstCommission.medianDays === null ? 'No sample yet' : d.launch.timeToFirstCommission.medianDays + ' days median' }}</strong>
              <small>{{ d.launch.timeToFirstCommission.sample }} activated partners · p90 {{ d.launch.timeToFirstCommission.p90Days ?? '—' }} days</small>
            </div>
          </section>

          <section class="panel">
            <h2>Ora actions</h2>
            <div class="rows">
              <div><span>Follow-up messages sent</span><strong>{{ d.ora.send.executed }}</strong></div>
              <div><span>Proposed</span><strong>{{ d.ora.send.proposed }}</strong></div>
              <div><span>Skipped</span><strong>{{ d.ora.send.skipped }}</strong></div>
              <div><span>Failed</span><strong>{{ d.ora.send.failed }}</strong></div>
              <div><span>All action cards proposed</span><strong>{{ d.ora.actionsProposed }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <h2>Customer retention</h2>
            <div class="rows">
              <div><span>Customers</span><strong>{{ d.retention.customers }}</strong></div>
              <div><span>Repeat customers</span><strong>{{ d.retention.repeatCustomers }} · {{ d.retention.repeatRate === null ? '—' : d.retention.repeatRate + '%' }}</strong></div>
              <div><span>Dormant / reorder due</span><strong>{{ d.retention.dormant }}</strong></div>
              <div><span>Outreach sent</span><strong>{{ d.retention.outreach }}</strong></div>
              <div><span>Repeat-customer revenue</span><strong>₦{{ d.retention.repeatCustomerRevenue | number: '1.0-0' }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <h2>Mentor playbook</h2>
            <div class="rows">
              <div><span>Check-ins logged</span><strong>{{ d.mentor.checkins }}</strong></div>
              <div><span>Active mentors</span><strong>{{ d.mentor.activeMentors }}</strong></div>
            </div>
            <p class="note">At-risk member counts and mentor-bonus readiness live on the partner Activation board; this view tracks whether mentors are using the rhythm.</p>
          </section>
        </div>

        <section class="panel">
          <div class="panel-head"><h2>Events by feature</h2><span class="pill">{{ d.events.byFeature.length }} features</span></div>
          @if (d.events.byFeature.length === 0) {
            <p class="note">No product events in this window yet. Deploy the new clients and re-check.</p>
          } @else {
            <div class="table-wrap">
              <table>
                <thead><tr><th>Feature</th><th>Events</th><th>Unique partners</th></tr></thead>
                <tbody>
                  @for (row of d.events.byFeature; track row.feature) {
                    <tr><td><strong>{{ row.feature }}</strong></td><td>{{ row.count }}</td><td>{{ row.partners }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [`
    .page { max-width: 1200px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 68em; color: var(--ms-text-muted); line-height: 1.6; }
    .periods { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); }
    .periods button { min-height: 34px; border-radius: 999px; }
    .periods button.active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .kpi { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .kpi-icon { width: 40px; height: 40px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kpi-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .kpi-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .kpi-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kpi-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .kpi div { display: flex; flex-direction: column; gap: 1px; }
    .kpi strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .kpi span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .kpi small { color: var(--ms-text-muted); font-size: 0.6875rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .panel { padding: 20px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .panel h2 { margin: 0 0 12px; font-size: 1.0625rem; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
    .rows { display: flex; flex-direction: column; }
    .rows div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--ms-line); }
    .rows div:last-child { border-bottom: 0; }
    .rows span { color: var(--ms-text-muted); font-size: 0.8125rem; }
    .rows strong { font-variant-numeric: tabular-nums; }
    .callout { margin-top: 12px; padding: 12px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); display: flex; flex-direction: column; gap: 2px; }
    .callout span { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .callout strong { color: var(--ms-primary-strong); }
    .callout small { color: var(--ms-text-muted); }
    .note { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.55; }
    .pill { padding: 3px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; }
    tbody tr:last-child td { border-bottom: 0; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    @media (max-width: 1000px) { .kpi-grid, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .page { padding: 16px; } .kpi-grid, .grid { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class AdminFeatureAdoptionComponent implements OnInit {
  private readonly analytics = inject(FeatureAnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periods = [7, 30, 90] as const;
  protected readonly period = signal(30);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<FeatureAdoption | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected setPeriod(days: number): void {
    this.period.set(days);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.analytics.adoption(this.period())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}
