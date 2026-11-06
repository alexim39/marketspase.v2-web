import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { environment } from '../../../../environments/environment';
import { AdminStoreService } from '../../../core/store-admin/admin-store.service';
import { AdminSettlements, AdminStoreOrder } from '../../../core/store-admin/admin-store.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';

@Component({
  selector: 'async-admin-store-orders',
  templateUrl: './admin-store-orders.component.html',
  styleUrls: ['./admin-store-orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ErrorStateComponent,
    PageSkeletonComponent,
    StatePanelComponent,
  ],
})
export class AdminStoreOrdersComponent implements OnInit {
  private readonly storeApi = inject(AdminStoreService);
  private readonly ui = inject(UiFeedbackService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<AdminStoreOrder[]>([]);
  protected readonly settlements = signal<AdminSettlements | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly refundingId = signal<string | null>(null);
  protected readonly refundTarget = signal<AdminStoreOrder | null>(null);
  protected readonly refundReason = signal('');
  protected readonly status = signal('all');
  protected query = '';
  protected readonly storeUrl = environment.storeUrl;

  protected readonly counts = computed(() => {
    const all = this.orders();
    return {
      total: all.length,
      held: all.filter((order) => order.escrow.status === 'held').length,
      delivered: all.filter((order) => order.status === 'delivered').length,
      awaiting: all.filter((order) => order.payment.status === 'paid' && !['delivered', 'cancelled', 'refunded'].includes(order.status)).length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected search(): void {
    this.load();
  }

  protected setStatus(status: string): void {
    this.status.set(status);
    this.load();
  }

  protected clearFilters(): void {
    this.query = '';
    this.status.set('all');
    this.load();
  }

  protected releaseEscrow(order: AdminStoreOrder): void {
    if (this.busyId()) return;
    if (!window.confirm(`Release ${this.money(order.amounts.partnerPending)} to ${order.store.name} now?`)) return;
    this.busyId.set(order.id);
    this.error.set(null);
    this.storeApi.releaseEscrow(order.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (response) => {
          this.orders.update((orders) => orders.map((item) => (
            item.id === response.data.id ? response.data : item
          )));
          this.ui.success('Escrow released to the partner wallet');
          this.loadSettlements();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected refund(order: AdminStoreOrder): void {
    if (this.refundingId()) return;
    this.refundTarget.set(order);
    this.refundReason.set('');
  }

  protected cancelRefund(): void {
    this.refundTarget.set(null);
    this.refundReason.set('');
  }

  protected submitRefund(): void {
    const target = this.refundTarget();
    const reason = this.refundReason().trim();
    if (!target || reason.length < 3) {
      this.ui.info('Add a short reason before refunding.');
      return;
    }
    this.refundingId.set(target.id);
    this.error.set(null);
    this.storeApi.refundOrder(target.id, reason)
      .pipe(finalize(() => this.refundingId.set(null)))
      .subscribe({
        next: (response) => {
          this.orders.update((orders) => orders.map((item) => (
            item.id === response.data.id ? response.data : item
          )));
          this.ui.success(`Order ${response.data.orderNumber} refunded`);
          this.cancelRefund();
          this.loadSettlements();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending_payment: 'Awaiting payment',
      paid: 'Paid',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    };
    return labels[status] ?? status;
  }

  protected escrowLabel(order: AdminStoreOrder): string {
    if (order.escrow.status === 'released') return 'Released';
    if (order.escrow.status === 'held') return 'In escrow';
    return 'Not funded';
  }

  protected units(order: AdminStoreOrder): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  protected money(value: number): string {
    return `₦${(Number(value) || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin([
      this.storeApi.orders({ q: this.query, status: this.status() === 'all' ? undefined : this.status() }),
      this.storeApi.settlements(),
    ]).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ([orders, settlements]) => {
        this.orders.set(orders.data ?? []);
        this.settlements.set(settlements.data);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadSettlements(): void {
    this.storeApi.settlements().subscribe({
      next: (response) => this.settlements.set(response.data),
      error: () => undefined,
    });
  }
}
