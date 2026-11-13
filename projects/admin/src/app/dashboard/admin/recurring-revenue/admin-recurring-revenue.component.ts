import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ApiError, userError } from '../../../core/http/api-error';
import { FeatureAnalyticsService } from '../../../core/analytics/feature-analytics.service';
import { RecurringRevenue } from '../../../core/analytics/feature-analytics.models';

@Component({
  selector: 'async-admin-recurring-revenue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, PageSkeletonComponent],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Commerce · Retention</p>
          <h1>Recurring revenue readiness</h1>
          <p class="subtitle">A data-backed decision on bundles, repeat-order plans and subscriptions. This page measures demand; it does not create a subscription product.</p>
        </div>
        <div class="periods" role="group" aria-label="Period">
          @for (days of periods; track days) {
            <button mat-button type="button" [class.active]="period() === days" (click)="setPeriod(days)">{{ days }}d</button>
          }
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="recurring revenue" [showHeader]="false" />
      } @else if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="load()">Retry</button></div>
      } @else if (data(); as d) {
        <section class="recommendation">
          <span class="rec-icon"><mat-icon>lightbulb</mat-icon></span>
          <div>
            <p class="eyebrow">Recommendation</p>
            <h2>{{ d.recommendation }}</h2>
            <p>Based on {{ d.days }} days: {{ d.repeatCustomers }} repeat customers, {{ d.repeatRate === null ? '—' : d.repeatRate + '%' }} repeat rate and {{ d.dormantCustomers }} dormant customers.</p>
          </div>
        </section>

        <section class="kpi-grid">
          <div class="kpi"><span>Customers</span><strong>{{ d.customers }}</strong><small>{{ d.orders }} paid orders</small></div>
          <div class="kpi"><span>Repeat customers</span><strong>{{ d.repeatCustomers }}</strong><small>{{ d.repeatRate === null ? '—' : d.repeatRate + '%' }} repeat rate</small></div>
          <div class="kpi"><span>Loyal (3+ orders)</span><strong>{{ d.loyalCustomers }}</strong><small>Strong subscription candidates</small></div>
          <div class="kpi"><span>Dormant / reorder due</span><strong>{{ d.dormantCustomers }}</strong><small>Win-back opportunity</small></div>
          <div class="kpi"><span>Avg orders / customer</span><strong>{{ d.avgOrdersPerCustomer }}</strong><small>Repeat depth</small></div>
          <div class="kpi"><span>Repeat revenue share</span><strong>{{ d.repeatRevenueShare === null ? '—' : d.repeatRevenueShare + '%' }}</strong><small>₦{{ d.repeatCustomerRevenue | number: '1.0-0' }} of ₦{{ d.revenue | number: '1.0-0' }}</small></div>
        </section>

        <div class="grid">
          <section class="panel">
            <h2>Repeat products</h2>
            @if (d.topRepeatProducts.length === 0) {
              <p class="note">Not enough paid orders in this window to rank products.</p>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Product</th><th>Units</th><th>Buyers</th></tr></thead>
                  <tbody>
                    @for (product of d.topRepeatProducts; track product.name) {
                      <tr><td><strong>{{ product.name }}</strong></td><td>{{ product.units }}</td><td>{{ product.buyers }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <section class="panel">
            <h2>Decision guide</h2>
            <div class="guide">
              <div><span>Below 20% repeat rate</span><p>Fix first-purchase confidence, delivery clarity and product education before subscriptions.</p></div>
              <div><span>20–35% repeat rate</span><p>Launch bundles and reorder reminders first; measure repeat conversion for 60–90 days.</p></div>
              <div><span>Above 35% with 10+ repeat customers</span><p>Test a repeat-order plan or subscription on the top repeat products, with clear cancellation and disclosure.</p></div>
            </div>
            <p class="note">Do not describe subscriptions as guaranteed income. Keep recurring charges consent-based, cancellable and separate from campaign budgets.</p>
          </section>
        </div>
      }
    </section>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 68em; color: var(--ms-text-muted); line-height: 1.6; }
    .periods { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); }
    .periods button { min-height: 34px; border-radius: 999px; }
    .periods button.active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .recommendation { display: flex; gap: 16px; padding: 20px; border-radius: var(--ms-radius-lg); border: 1px solid var(--ms-primary); background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-surface)); }
    .rec-icon { width: 48px; height: 48px; flex: none; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-surface); color: var(--ms-primary-strong); }
    .recommendation h2 { margin: 4px 0 6px; font-size: 1.25rem; }
    .recommendation p { margin: 0; color: var(--ms-text-muted); line-height: 1.6; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .kpi span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .kpi strong { font-family: var(--ms-font-display); font-size: 1.75rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .kpi small { color: var(--ms-text-muted); font-size: 0.6875rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .panel { padding: 20px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .panel h2 { margin: 0 0 12px; font-size: 1.0625rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; }
    tbody tr:last-child td { border-bottom: 0; }
    .guide { display: flex; flex-direction: column; gap: 10px; }
    .guide div { padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .guide span { display: block; font-size: 0.75rem; font-weight: 700; color: var(--ms-primary-strong); text-transform: uppercase; letter-spacing: 0.04em; }
    .guide p { margin: 4px 0 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.55; }
    .note { margin: 12px 0 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.55; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    @media (max-width: 900px) { .kpi-grid, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .page { padding: 16px; } .kpi-grid, .grid { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class AdminRecurringRevenueComponent implements OnInit {
  private readonly analytics = inject(FeatureAnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periods = [90, 180, 365] as const;
  protected readonly period = signal(90);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<RecurringRevenue | null>(null);

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
    this.analytics.recurringRevenue(this.period())
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
