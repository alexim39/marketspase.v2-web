import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StoreOrdersFacade } from '../state/store-orders.facade';
import { StoreOrdersInsightComponent } from '../insight/store-orders-insight.component';

@Component({
  selector: 'async-store-orders-desktop',
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
    PageSkeletonComponent,
    ErrorStateComponent,
    RouterModule,
    StoreOrdersInsightComponent,
  ],
})
export class StoreOrdersDesktopComponent implements OnInit {
  private readonly facade = inject(StoreOrdersFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly busyId = this.facade.busyId;
  protected readonly orders = this.facade.orders;
  protected readonly returns = this.facade.returns;
  protected readonly earnings = this.facade.earnings;
  protected readonly filter = this.facade.filter;
  protected readonly drafts = this.facade.drafts;
  protected readonly actionCount = this.facade.actionCount;
  protected readonly openReturns = this.facade.openReturns;
  protected readonly visibleOrders = this.facade.visibleOrders;

  ngOnInit(): void { this.facade.ensureLoaded(); }
  protected reload(): void { this.facade.reload(); }
  protected setFilter(filter: Parameters<StoreOrdersFacade['setFilter']>[0]): void { this.facade.setFilter(filter); }
  protected draft(order: Parameters<StoreOrdersFacade['draft']>[0]) { return this.facade.draft(order); }
  protected setDraft(orderId: string, field: 'courier' | 'trackingNumber', value: unknown): void { this.facade.setDraft(orderId, field, value); }
  protected transition(order: Parameters<StoreOrdersFacade['transition']>[0], status: 'processing' | 'shipped' | 'delivered'): void { this.facade.transition(order, status); }
  protected decideReturn(request: Parameters<StoreOrdersFacade['decideReturn']>[0], action: 'approve' | 'reject' | 'receive'): void { this.facade.decideReturn(request, action); }
  protected statusLabel(status: string): string { return this.facade.statusLabel(status); }
  protected escrowLabel(order: Parameters<StoreOrdersFacade['escrowLabel']>[0]): string { return this.facade.escrowLabel(order); }
  protected totalUnits(order: Parameters<StoreOrdersFacade['totalUnits']>[0]): number { return this.facade.totalUnits(order); }
}
