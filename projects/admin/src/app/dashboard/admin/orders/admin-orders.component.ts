import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminOrderService, OrderRow } from './admin-order.service';
import { ApiError } from '../../../core/http/api-error';

type QueueFilter = 'Pending' | 'Fulfilled' | 'Cancelled' | 'All';

/**
 * @title Product orders — admin fulfillment queue.
 *
 * Money is already debited when rows land here: fulfill them (ship) or
 * cancel with a full refund. FIFO oldest-first; buyer notified on every
 * move. OnPush + signals.
 */
@Component({
  selector: 'async-admin-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, MatButtonModule, MatChipsModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule,
    MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Product orders</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Product orders</h2>
          <p class="subtitle">Paid orders waiting on fulfillment — ship them or cancel with a full refund.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">
          <mat-icon>check_circle</mat-icon> {{ note }}
        </p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="filter()" (selectionChange)="filter.set($event.value); pageIndex.set(0); reload()">
            @for (f of filters; track f) {
              <mat-option [value]="f">{{ f === 'All' ? 'All statuses' : f }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (total() > 0) {
          <mat-chip highlighted>{{ total() }} order{{ total() === 1 ? '' : 's' }}</mat-chip>
        }
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="buyer">
              <th mat-header-cell *matHeaderCellDef>Buyer</th>
              <td mat-cell *matCellDef="let row" class="name-cell">
                {{ row.owner?.name ?? '—' }}
                <span class="muted">{{ row.owner?.phone ?? '' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="items">
              <th mat-header-cell *matHeaderCellDef>Items</th>
              <td mat-cell *matCellDef="let row">{{ itemSummary(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="ship">
              <th mat-header-cell *matHeaderCellDef>Ship to</th>
              <td mat-cell *matCellDef="let row">
                @if (row.shipping) {
                  <span class="ship-name">{{ row.shipping.fullName }}</span>
                  <span class="muted margin-sub">{{ row.shipping.street }}, {{ row.shipping.city }}, {{ row.shipping.state }}</span>
                  <span class="muted margin-sub">{{ row.shipping.phone }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let row" class="num-cell">₦{{ row.totalCost | number }}</td>
            </ng-container>
            <ng-container matColumnDef="margin">
              <th mat-header-cell *matHeaderCellDef>Margin</th>
              <td mat-cell *matCellDef="let row">
                @if (row.grossMargin !== undefined && row.grossMargin !== null) {
                  <span class="num-cell">₦{{ row.grossMargin | number }}</span>
                  <span class="muted margin-sub">commissionable ₦{{ row.commissionableMargin ?? 0 | number }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef>Waiting</th>
              <td mat-cell *matCellDef="let row">{{ ageInQueue(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status {{ statusTone(row.orderStatus) }}">{{ row.orderStatus }}</span>
                @if (row.saleMode === 'resale' || row.saleMode === 'mixed') {
                  <span class="muted margin-sub">Resale</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                @if (confirming()?.id === row._id) {
                  <button
                    mat-flat-button
                    [color]="confirming()?.kind === 'fulfill' ? 'primary' : 'warn'"
                    (click)="apply(row)"
                    [disabled]="actingId() === row._id"
                  >{{ actingLabel(row) }}</button>
                  <button mat-button (click)="confirming.set(null)">Cancel</button>
                } @else {
                  @if (row.orderStatus === 'Pending') {
                    <button mat-flat-button color="primary" (click)="arm(row._id, 'fulfill')" [disabled]="actingId() === row._id">Fulfill</button>
                    <button mat-button color="warn" (click)="arm(row._id, 'cancel')" [disabled]="actingId() === row._id">Cancel</button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <mat-paginator
            [length]="total()"
            [pageSize]="pageSize()"
            [pageIndex]="pageIndex()"
            [pageSizeOptions]="[10, 25, 50]"
            (page)="onPage($event)"
          ></mat-paginator>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">Queue clear — no orders{{ filter() === 'All' ? '' : ' under ' + filter() }}.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { display: flex; align-items: center; gap: 0.5em; background: var(--ms-success-soft); color: var(--ms-success); border-radius: 8px; padding: 0.7em 1em; margin: 0; }
    html[data-theme='dark'] .notice { color: #9ccc9f; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .name-cell .muted { display: block; font-weight: 400; }
    .num-cell { text-align: right; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .margin-sub { display: block; font-size: 0.72em; }
    .ship-name { display: block; font-weight: 600; font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
    .empty { color: var(--ms-text-muted); }
    button { min-height: 44px; }
  `],
})
export class AdminOrdersComponent implements OnInit {
  private readonly admin = inject(AdminOrderService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirming = signal<{ id: string; kind: 'fulfill' | 'cancel' } | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<OrderRow[]>([]);
  protected readonly total = signal(0);
  protected readonly filter = signal<QueueFilter>('Pending');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);

  protected readonly filters: QueueFilter[] = ['Pending', 'Fulfilled', 'Cancelled', 'All'];
  protected readonly displayedColumns = ['buyer', 'items', 'ship', 'total', 'margin', 'age', 'status', 'action'];

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .queue(this.filter(), this.pageIndex() * this.pageSize(), this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.total.set(res.meta?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload();
  }

  protected itemSummary(row: OrderRow): string {
    const items = row.products ?? [];
    if (items.length === 0) return '—';
    const first = items[0];
    const name = first?.product?.name ?? 'Item';
    const qty = first?.quantity ?? 1;
    const head = `${qty}× ${name}`;
    return items.length > 1 ? `${head} +${items.length - 1} more` : head;
  }

  protected ageInQueue(row: OrderRow): string {
    const ms = Date.now() - new Date(row.createdAt ?? 0).getTime();
    if (Number.isNaN(ms) || ms < 0) return '—';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'just now';
    const units: Array<[string, number]> = [['y', 525600], ['mo', 43200], ['w', 10080], ['d', 1440], ['h', 60], ['m', 1]];
    const parts: string[] = [];
    let rest = minutes;
    for (const [label, size] of units) {
      const n = Math.floor(rest / size);
      if (n > 0) {
        parts.push(`${n}${label}`);
        rest -= n * size;
      }
      if (parts.length === 2) break;
    }
    return parts.join(' ');
  }

  protected statusTone(status: string): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'fulfilled': return 'dp-status--ok';
      case 'pending': return 'dp-status--warn';
      case 'cancelled': return 'dp-status--bad';
      default: return 'dp-status--info';
    }
  }

  protected arm(id: string, kind: 'fulfill' | 'cancel'): void {
    this.confirming.set({ id, kind });
    this.notice.set(null);
  }

  protected actingLabel(row: OrderRow): string {
    if (this.actingId() === row._id) return 'Working…';
    return this.confirming()?.kind === 'fulfill' ? 'Confirm fulfill?' : 'Confirm cancel + refund?';
  }

  protected apply(row: OrderRow): void {
    const c = this.confirming();
    if (!c || this.actingId()) return;
    this.actingId.set(row._id);
    this.admin
      .decide(row._id, c.kind === 'fulfill' ? 'Fulfilled' : 'Cancelled')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.actingId.set(null);
          this.confirming.set(null);
          const commission = res?.commission;
          if (commission?.error) {
            this.error.set('Order updated, but product commission release failed. Check the compensation console.');
          } else if (c.kind === 'fulfill' && Number(commission?.released) > 0) {
            this.notice.set(`Order fulfilled — ${commission.released} commission ${commission.released === 1 ? 'entry' : 'entries'} released.`);
          } else {
            this.notice.set(
              c.kind === 'fulfill'
                ? 'Order fulfilled — buyer notified.'
                : 'Order cancelled — full refund issued, buyer notified.',
            );
          }
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
