import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AdminService } from '../../../core/admin/admin.service';
import { AuditEntry, PlatformStats } from '../../../core/admin/admin.models';
import { ApiError, userError } from '../../../core/http/api-error';

@Component({
  selector: 'async-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
})
export class AdminDashboardComponent implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<PlatformStats | null>(null);
  protected readonly audit = signal<AuditEntry[]>([]);

  protected readonly shortcuts = [
    { label: 'Partner stores', detail: 'Directory, publishing and suspensions', link: '/stores', icon: 'storefront' },
    { label: 'Store orders', detail: 'Every customer order across partner stores', link: '/store-orders', icon: 'receipt_long' },
    { label: 'Escrow & settlements', detail: 'Held earnings, releases and payment fees', link: '/store-settlements', icon: 'account_balance_wallet' },
    { label: 'Activation desk', detail: 'Starter orders and identity checks', link: '/activation', icon: 'verified_user' },
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

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin([
      this.admin.stats(),
      this.admin.audit({ limit: 8 }),
    ]).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ([stats, audit]) => {
        this.stats.set(stats.data);
        this.audit.set(audit.data.items ?? []);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
