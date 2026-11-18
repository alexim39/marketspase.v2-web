import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StatCardComponent } from '@marketspase/shared/ui/stat-card/stat-card.component';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService } from '../../../core/admin/admin.service';
import { AuditEntry, PlatformStats } from '../../../core/admin/admin.models';
import { AdminSummaryService } from '../../../core/summaries/summary.service';
import { AdminSummary, SummaryKpi } from '../../../core/summaries/summary.models';
import { SummaryTrendComponent } from '../../../core/summaries/summary-trend.component';
import { SummaryDistributionComponent } from '../../../core/summaries/summary-distribution.component';
import { ApiError, userError } from '../../../core/http/api-error';

@Component({
  selector: 'async-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, EmptyStateComponent, ErrorStateComponent, MatButtonModule, MatIconModule, PageHeaderComponent, PageSkeletonComponent, RouterModule, StatCardComponent, SummaryTrendComponent, SummaryDistributionComponent],
})
export class AdminDashboardComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly summaries = inject(AdminSummaryService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<PlatformStats | null>(null);
  protected readonly audit = signal<AuditEntry[]>([]);
  protected readonly overview = signal<AdminSummary | null>(null);

  protected readonly shortcuts = [
    { label: 'Partner stores', detail: 'Directory, publishing and suspensions', link: '/stores', icon: 'storefront' },
    { label: 'Store orders', detail: 'Every customer order across partner stores', link: '/store-orders', icon: 'receipt_long' },
    { label: 'Escrow & settlements', detail: 'Held earnings, releases and payment fees', link: '/store-settlements', icon: 'account_balance_wallet' },
    { label: 'Partner activation', detail: 'Starter orders and identity checks', link: '/activation', icon: 'verified_user' },
    { label: 'Compensation', detail: 'Commissions, ranks and mentor bonuses', link: '/compensation', icon: 'workspace_premium' },
    { label: 'Growth campaigns', detail: 'Budgets, allocation and close-out', link: '/growth', icon: 'hub' },
    { label: 'Support tickets', detail: 'Member requests and issue resolution', link: '/tickets', icon: 'support_agent' },
    { label: 'Audit log', detail: 'Who changed what, and when', link: '/audit', icon: 'history' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  protected actionLabel(action: string): string {
    return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected kpiIcon(kpi: SummaryKpi): string {
    const icons: Record<string, string> = {
      total: 'groups', active: 'bolt', new: 'person_add', in: 'south_west', out: 'north_east',
      net: 'swap_vert', gmv: 'paid', escrow: 'account_balance_wallet', open: 'support_agent',
      campaigns: 'hub', watch: 'play_circle', subscribers: 'mail', pending: 'pending_actions',
      liability: 'account_balance_wallet',
    };
    return icons[kpi.key] ?? 'insights';
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
    forkJoin({
      stats: this.admin.stats(),
      audit: this.admin.audit({ limit: 8 }),
      overview: this.summaries.get('overview', 30).pipe(catchError(() => of(null))),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ stats, audit, overview }) => {
        this.stats.set(stats.data);
        this.audit.set(audit.data.items ?? []);
        this.overview.set(overview?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
