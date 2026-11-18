import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ChartThemeService } from '../../../../core/charts/chart-theme.service';
import type { EChartsCoreOption } from '../../../../core/charts/echarts-setup';
import { WalletDashboardFacade } from '../state/wallet-dashboard.facade';

type WeekBucket = {
  key: string;
  label: string;
  in: number;
  out: number;
};

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
 * Wallet cash-flow visual. Keeps the existing totals cards but adds the one
 * thing they cannot show: whether money is moving in a healthy direction.
 */
@Component({
  selector: 'async-wallet-cashflow-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="cashflow-card" aria-labelledby="wallet-cashflow-title">
      <header class="cashflow-head">
        <div>
          <p class="eyebrow">Cash flow</p>
          <h2 id="wallet-cashflow-title">Money in and out</h2>
          <p>Wallet activity over the last eight weeks.</p>
        </div>
        @if (hasData()) {
          <span class="net-chip" [class.negative]="net() < 0">
            {{ net() >= 0 ? '+' : '' }}{{ vm.money(net(), 0) }} net
          </span>
        }
      </header>

      @if (hasData()) {
        <div
          echarts
          [options]="chart()"
          class="chart"
          role="img"
          aria-label="Money in and money out by month for the last six months"></div>
        <footer class="cashflow-foot">
          <span><i class="dot dot--in" aria-hidden="true"></i> In {{ vm.money(periodIn(), 0) }}</span>
          <span><i class="dot dot--out" aria-hidden="true"></i> Out {{ vm.money(periodOut(), 0) }}</span>
          <a routerLink="/dashboard/ora">Ask Ora about this</a>
        </footer>
      } @else {
        <div class="empty">
          <mat-icon>insights</mat-icon>
          <div>
            <strong>No cash-flow history yet</strong>
            <span>Deposits, commissions and withdrawals will appear here as soon as money moves.</span>
          </div>
          <a mat-button routerLink="/dashboard/wallet/deposit">Deposit</a>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .cashflow-card {
      padding: 22px 24px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-2xl);
      background:
        radial-gradient(380px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 60%, transparent), transparent 72%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .cashflow-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .cashflow-head h2 { margin: 4px 0 5px; font-size: 1.18rem; letter-spacing: -0.02em; }
    .cashflow-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.5; }

    .net-chip {
      flex: none;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--ms-success-soft);
      color: var(--ms-success);
      font-size: 0.72rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .net-chip.negative { background: var(--ms-error-soft); color: var(--ms-error); }

    .chart { width: 100%; height: 260px; }

    .cashflow-foot {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.72rem;
    }
    .cashflow-foot span { display: inline-flex; align-items: center; gap: 5px; }
    .cashflow-foot a { margin-left: auto; color: var(--ms-primary-strong); font-weight: 700; text-decoration: none; }
    .cashflow-foot a:hover { text-decoration: underline; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot--in { background: var(--ms-success); }
    .dot--out { background: var(--ms-error); }

    .empty {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px;
      border: 1px dashed var(--ms-line);
      border-radius: var(--ms-radius-lg);
      color: var(--ms-text-muted);
      flex-wrap: wrap;
    }
    .empty > mat-icon { flex: none; width: 42px; height: 42px; padding: 9px; box-sizing: border-box; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .empty strong { color: var(--ms-text); font-size: 0.9rem; }
    .empty span { font-size: 0.75rem; line-height: 1.45; }
    .empty a { flex: none; }

    @media (max-width: 760px) {
      .cashflow-card { padding: 18px 16px; }
      .chart { height: 230px; }
      .cashflow-foot a { margin-left: 0; }
      .empty a { width: 100%; justify-content: center; }
    }
  `],
})
export class WalletCashflowChartComponent {
  protected readonly vm = inject(WalletDashboardFacade);
  private readonly theme = inject(ChartThemeService);

  private readonly buckets = computed<WeekBucket[]>(() => {
    const currentWeek = weekStart(new Date());
    const rows: WeekBucket[] = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() - 7 * (7 - index));
      return {
        key: localKey(date),
        label: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
        in: 0,
        out: 0,
      };
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const tx of this.vm.txs()) {
      const at = tx.at ? new Date(tx.at) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      const bucket = byKey.get(localKey(weekStart(at)));
      if (!bucket) continue;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (this.vm.isCreditTx(tx)) bucket.in += amount;
      else bucket.out += amount;
    }
    return rows;
  });

  protected readonly periodIn = computed(() => this.buckets().reduce((sum, row) => sum + row.in, 0));
  protected readonly periodOut = computed(() => this.buckets().reduce((sum, row) => sum + row.out, 0));
  protected readonly net = computed(() => this.periodIn() - this.periodOut());
  protected readonly hasData = computed(() => this.buckets().some((row) => row.in > 0 || row.out > 0));

  protected readonly chart = computed<EChartsCoreOption>(() => {
    const palette = this.theme.palette();
    const axis = this.theme.axis();
    const rows = this.buckets();
    return {
      ...this.theme.base(),
      grid: { left: 8, right: 8, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => this.vm.money(Number(value) || 0, 0),
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: palette.muted, fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: rows.map((row) => row.label),
        ...axis,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        ...axis,
        axisLabel: {
          ...axis.axisLabel,
          formatter: (value: number) => this.shortMoney(value),
        },
      },
      series: [
        {
          name: 'Money in',
          type: 'bar',
          data: rows.map((row) => row.in),
          barMaxWidth: 20,
          itemStyle: { color: palette.success, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Money out',
          type: 'bar',
          data: rows.map((row) => row.out),
          barMaxWidth: 20,
          itemStyle: { color: palette.error, borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  });

  private shortMoney(value: number): string {
    const amount = Math.abs(Number(value) || 0);
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}m`;
    if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`;
    return `₦${Math.round(amount)}`;
  }
}
