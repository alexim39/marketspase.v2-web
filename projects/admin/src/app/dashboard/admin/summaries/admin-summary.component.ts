import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AdminSummaryService } from '../../../core/summaries/summary.service';
import { AdminSummary, SummaryKpi } from '../../../core/summaries/summary.models';
import { SummaryTrendComponent } from '../../../core/summaries/summary-trend.component';
import { SummaryDistributionComponent } from '../../../core/summaries/summary-distribution.component';
import { ApiError, userError } from '../../../core/http/api-error';

const KPI_ICONS: Record<string, string> = {
  total: 'groups',
  new: 'person_add',
  active: 'bolt',
  dormant: 'schedule',
  activated: 'verified',
  kyc: 'verified_user',
  suspended: 'block',
  in: 'south_west',
  out: 'north_east',
  net: 'swap_vert',
  pending: 'pending_actions',
  liability: 'account_balance_wallet',
  refunds: 'undo',
  stores: 'storefront',
  products: 'inventory_2',
  orders: 'receipt_long',
  gmv: 'paid',
  fees: 'percent',
  escrow: 'account_balance_wallet',
  campaigns: 'hub',
  budget: 'savings',
  spent: 'trending_down',
  remaining: 'account_balance',
  allocations: 'group_add',
  open: 'support_agent',
  old: 'schedule',
  high: 'priority_high',
  resolved: 'task_alt',
  resolution: 'timer',
  videos: 'smart_display',
  watch: 'play_circle',
  reflections: 'forum',
  courses: 'school',
  learners: 'groups',
  subscribers: 'mail',
  sent: 'campaign',
  reach: 'public',
  scheduled: 'event',
  failed: 'error',
};

@Component({
  selector: 'async-admin-summary',
  templateUrl: './admin-summary.component.html',
  styleUrls: ['./admin-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    PageSkeletonComponent,
    SummaryTrendComponent,
    SummaryDistributionComponent,
  ],
})
export class AdminSummaryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly summaries = inject(AdminSummaryService);

  protected readonly windows = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
  ];
  protected readonly days = signal(30);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<AdminSummary | null>(null);

  private readonly domain = String(this.route.snapshot.data['domain'] ?? '').trim();

  ngOnInit(): void {
    if (!this.domain) {
      this.error.set('Summary domain is not configured.');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  protected setDays(days: number): void {
    if (days === this.days() || this.loading()) return;
    this.days.set(days);
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  protected kpiIcon(kpi: SummaryKpi): string {
    return KPI_ICONS[kpi.key] ?? 'insights';
  }

  protected formatKpi(kpi: SummaryKpi): string {
    if (kpi.format === 'currency') {
      return `₦${(Number(kpi.value) || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
    }
    if (kpi.format === 'percent') return `${(Number(kpi.value) || 0).toFixed(1)}%`;
    if (typeof kpi.value === 'number') return kpi.value.toLocaleString('en-NG');
    return String(kpi.value ?? '—');
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.summaries.get(this.domain, this.days()).subscribe({
      next: (response) => {
        this.summary.set(response.data ?? null);
        if (!response.data) this.error.set('No summary data was returned.');
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
      },
    });
  }
}
