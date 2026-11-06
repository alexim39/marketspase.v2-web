import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AdminStoreService } from '../../../core/store-admin/admin-store.service';
import { AdminSettlements, AdminStoreOrder } from '../../../core/store-admin/admin-store.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';

@Component({
  selector: 'async-admin-store-settlements',
  templateUrl: './admin-store-settlements.component.html',
  styleUrls: ['./admin-store-settlements.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, EmptyStateComponent, ErrorStateComponent, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
})
export class AdminStoreSettlementsComponent implements OnInit {
  private readonly storeApi = inject(AdminStoreService);
  private readonly ui = inject(UiFeedbackService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<AdminSettlements | null>(null);
  protected readonly heldOrders = signal<AdminStoreOrder[]>([]);
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  protected release(order: AdminStoreOrder): void {    if (this.busyId()) return;
    if (!window.confirm(`Release ${this.money(order.amounts.partnerPending)} to ${order.store.name}?`)) return;
    this.busyId.set(order.id);
    this.error.set(null);
    this.storeApi.releaseEscrow(order.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.ui.success('Escrow released');
          this.load();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected money(value: number): string {
    return `₦${(Number(value) || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin([
      this.storeApi.settlements(),
      this.storeApi.orders({ status: 'delivered' }),
    ]).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ([summary, orders]) => {
        this.summary.set(summary.data);
        this.heldOrders.set((orders.data ?? []).filter((order) => order.escrow.status === 'held'));
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
