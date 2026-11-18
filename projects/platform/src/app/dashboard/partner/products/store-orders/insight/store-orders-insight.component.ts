import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { StoreOrdersFacade } from '../state/store-orders.facade';

type Week = { key: string; label: string; revenue: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const localKey = (date: Date): string => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const weekStart = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
};

/**
 * Store order snapshot: recent merchandise sales by week and a fulfilment
 * status mix. Uses the existing owner-scoped order list, no extra API call.
 */
@Component({
  selector: 'async-store-orders-insight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="order-insight" aria-labelledby="store-orders-insight-title">
      <header class="insight-head">
        <div>
          <p class="eyebrow">Order snapshot</p>
          <h2 id="store-orders-insight-title">Sales and fulfilment</h2>
          <p>Paid merchandise over the last eight weeks, plus what still needs action.</p>
        </div>
        @if (hasData()) {
          <span class="revenue">{{ revenue() | currency:'₦':'symbol':'1.0-0' }} <small>8-week sales</small></span>
        }
      </header>

      @if (hasData()) {
        <div class="insight-body">
          <div class="chart-side">
            @if (revenue() > 0) {
              <div class="week-bars" role="img" aria-label="Paid merchandise sales by week">
                @for (week of weeks(); track week.key) {
                  <div class="week">
                    <span class="bar" [style.height.%]="barHeight(week.revenue)" [title]="week.label + ': ' + (week.revenue | currency:'₦':'symbol':'1.0-0')"></span>
                    <small>{{ week.label }}</small>
                  </div>
                }
              </div>
            } @else {
              <div class="no-sales">
                <mat-icon>receipt_long</mat-icon>
                <div><strong>No paid merchandise yet</strong><span>Paid orders will build the sales trend here.</span></div>
              </div>
            }
          </div>

          <div class="status-side">
            @for (group of statusGroups(); track group.key) {
              <div class="status-row">
                <span class="dot" [class]="'dot dot--' + group.tone" aria-hidden="true"></span>
                <span>{{ group.label }}</span>
                <strong>{{ group.count | number }}</strong>
              </div>
            }
            <a routerLink="/dashboard/ora">Ask Ora what needs fulfilment</a>
          </div>
        </div>
      } @else {
        <div class="insight-empty">
          <mat-icon>storefront</mat-icon>
          <div>
            <strong>No store orders yet</strong>
            <span>When a customer pays for a product, sales and fulfilment activity appear here.</span>
          </div>
          <a mat-button routerLink="/dashboard/products/my-store">Open my store</a>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .order-insight {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .insight-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .insight-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .insight-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .revenue { flex: none; padding: 6px 10px; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.9rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .revenue small { display: block; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.8; }

    .insight-body {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.65fr);
      gap: 20px;
      align-items: end;
    }

    .week-bars { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 150px; padding: 8px 2px 0; border-bottom: 1px solid var(--ms-line); }
    .week { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6px; }
    .week .bar { display: block; width: 100%; max-width: 34px; min-height: 3px; border-radius: 5px 5px 0 0; background: linear-gradient(180deg, var(--ms-primary), color-mix(in srgb, var(--ms-primary) 58%, transparent)); transition: height 240ms ease; }
    .week small { color: var(--ms-text-muted); font-size: 0.6rem; white-space: nowrap; }
    .no-sales { display: flex; align-items: center; gap: 10px; min-height: 120px; padding: 16px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
    .no-sales > mat-icon { flex: none; width: 38px; height: 38px; padding: 8px; box-sizing: border-box; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .no-sales > div { display: flex; flex-direction: column; gap: 2px; }
    .no-sales strong { color: var(--ms-text); font-size: 0.84rem; }
    .no-sales span { font-size: 0.72rem; line-height: 1.45; }

    .status-side { display: flex; flex-direction: column; gap: 2px; }
    .status-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--ms-line); font-size: 0.76rem; }
    .status-row:first-child { border-top: 0; }
    .status-row span:nth-child(2) { flex: 1; color: var(--ms-text-muted); }
    .status-row strong { font-variant-numeric: tabular-nums; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
    .dot--warn { background: var(--ms-warning); }
    .dot--ok { background: var(--ms-success); }
    .dot--info { background: var(--ms-info); }
    .dot--bad { background: var(--ms-error); }
    .status-side a { margin-top: 8px; color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 700; text-decoration: none; }
    .status-side a:hover { text-decoration: underline; }

    .insight-empty { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); flex-wrap: wrap; }
    .insight-empty > mat-icon { flex: none; width: 38px; height: 38px; padding: 8px; box-sizing: border-box; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .insight-empty > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .insight-empty strong { color: var(--ms-text); font-size: 0.84rem; }
    .insight-empty span { font-size: 0.72rem; line-height: 1.45; }
    .insight-empty a { flex: none; }

    @media (max-width: 760px) {
      .order-insight { padding: 16px; }
      .insight-body { grid-template-columns: minmax(0, 1fr); }
      .week-bars { height: 130px; }
      .insight-empty a { width: 100%; justify-content: center; }
    }
  `],
})
export class StoreOrdersInsightComponent {
  private readonly vm = inject(StoreOrdersFacade);

  protected readonly orders = this.vm.orders;

  protected readonly weeks = computed<Week[]>(() => {
    const currentWeek = weekStart(new Date());
    const rows: Week[] = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() - 7 * (7 - index));
      return { key: localKey(date), label: `${date.getDate()} ${MONTHS[date.getMonth()]}`, revenue: 0 };
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const order of this.orders()) {
      if (order.payment?.status !== 'paid') continue;
      const at = order.paidAt ?? order.createdAt;
      const date = at ? new Date(at) : null;
      if (!date || Number.isNaN(date.getTime())) continue;
      const bucket = byKey.get(localKey(weekStart(date)));
      if (!bucket) continue;
      bucket.revenue += Number(order.amounts?.merchandise ?? 0);
    }
    return rows;
  });

  protected readonly revenue = computed(() => this.weeks().reduce((sum, week) => sum + week.revenue, 0));
  protected readonly hasData = computed(() => this.orders().length > 0);

  protected readonly statusGroups = computed(() => {
    const orders = this.orders();
    const count = (statuses: string[]) => orders.filter((order) => statuses.includes(order.status)).length;
    return [
      { key: 'action', label: 'Needs fulfilment', count: count(['paid', 'processing', 'shipped']), tone: 'warn' },
      { key: 'delivered', label: 'Delivered', count: count(['delivered']), tone: 'ok' },
      { key: 'awaiting', label: 'Awaiting payment', count: count(['pending_payment']), tone: 'info' },
      { key: 'closed', label: 'Cancelled / refunded', count: count(['cancelled', 'refunded']), tone: 'bad' },
    ];
  });

  protected barHeight(revenue: number): number {
    const max = Math.max(1, ...this.weeks().map((week) => week.revenue));
    return Math.max(3, (Number(revenue) || 0) / max * 100);
  }
}
