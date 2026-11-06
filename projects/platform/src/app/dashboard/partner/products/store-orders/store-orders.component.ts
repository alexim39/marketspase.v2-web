import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { StoreEarnings, StoreOrderSummary } from '../../../../core/store/store.models';
import { StoreService } from '../../../../core/store/store.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

type Filter = 'action' | 'delivered' | 'all';

@Component({
  selector: 'async-store-orders',
  templateUrl: './store-orders.component.html',
  styleUrls: ['./store-orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
  ],
})
export class StoreOrdersComponent implements OnInit {
  private readonly storeApi = inject(StoreService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly orders = signal<StoreOrderSummary[]>([]);
  protected readonly earnings = signal<StoreEarnings | null>(null);
  protected readonly filter = signal<Filter>('action');
  protected readonly drafts = signal<Record<string, { courier: string; trackingNumber: string }>>({});

  protected readonly actionCount = computed(() => (
    this.orders().filter((order) => ['paid', 'processing', 'shipped'].includes(order.status)).length
  ));

  protected readonly visibleOrders = computed(() => {
    const filter = this.filter();
    if (filter === 'all') return this.orders();
    if (filter === 'delivered') return this.orders().filter((order) => order.status === 'delivered');
    return this.orders().filter((order) => ['paid', 'processing', 'shipped'].includes(order.status));
  });

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected draft(order: StoreOrderSummary): { courier: string; trackingNumber: string } {
    return this.drafts()[order.id] ?? {
      courier: order.fulfilment?.courier ?? '',
      trackingNumber: order.fulfilment?.trackingNumber ?? '',
    };
  }

  protected setDraft(orderId: string, field: 'courier' | 'trackingNumber', value: unknown): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [orderId]: {
        courier: field === 'courier' ? String(value ?? '') : (drafts[orderId]?.courier ?? ''),
        trackingNumber: field === 'trackingNumber'
          ? String(value ?? '')
          : (drafts[orderId]?.trackingNumber ?? ''),
      },
    }));
  }

  protected transition(order: StoreOrderSummary, status: 'processing' | 'shipped' | 'delivered'): void {
    if (this.busyId()) return;
    if (status === 'shipped') {
      const draft = this.draft(order);
      if (!draft.courier.trim() || !draft.trackingNumber.trim()) {
        this.ui.info('Add the courier and tracking number before marking it shipped.');
        return;
      }
    }
    if (status === 'delivered' && !window.confirm(
      'Mark this order as delivered? The 7-day escrow release window starts now.',
    )) {
      return;
    }

    const draft = this.draft(order);
    const body: Record<string, unknown> = { status };
    if (draft.courier.trim()) body['courier'] = draft.courier.trim();
    if (draft.trackingNumber.trim()) body['trackingNumber'] = draft.trackingNumber.trim();

    this.busyId.set(order.id);
    this.error.set(null);
    this.storeApi.updateOrder(order.id, body)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (response) => {
          this.orders.update((orders) => orders.map((item) => (
            item.id === response.data.id ? response.data : item
          )));
          this.ui.success(this.statusMessage(response.data.status));
          this.loadEarnings();
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

  protected escrowLabel(order: StoreOrderSummary): string {
    if (order.escrow.status === 'released') return 'Released';
    if (order.escrow.status === 'held') return 'In escrow';
    return 'Not funded';
  }

  protected totalUnits(order: StoreOrderSummary): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  private statusMessage(status: string): string {
    if (status === 'processing') return 'Order moved to processing';
    if (status === 'shipped') return 'Order marked shipped';
    if (status === 'delivered') return 'Order delivered; escrow release scheduled';
    return 'Order updated';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin([this.storeApi.orders(), this.storeApi.earnings()])
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ([orders, earnings]) => {
          this.orders.set(orders.data ?? []);
          this.earnings.set(earnings.data);
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  private loadEarnings(): void {
    this.storeApi.earnings().subscribe({
      next: (response) => this.earnings.set(response.data),
      error: () => undefined,
    });
  }
}
