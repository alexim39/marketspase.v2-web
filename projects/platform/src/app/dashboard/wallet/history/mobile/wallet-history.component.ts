import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StatusChipComponent, StatusTone } from '@marketspase/shared/ui/status-chip/status-chip.component';
import { WalletHistoryFacade } from '../state/wallet-history.facade';

@Component({
  selector: 'async-wallet-history-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MobileCardComponent,
    MobilePageShellComponent,
    PageSkeletonComponent,
    RouterModule,
    StatusChipComponent,
  ],
  template: `
    <async-mobile-page-shell
      eyebrow="Wallet · History"
      title="Transaction history"
      backLink="/dashboard/wallet"
      backLabel="Back to wallet"
    >
      <p class="intro">Deposits, purchases, refunds and adjustments — newest first.</p>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput type="search" [value]="vm.query()" (input)="setQuery($any($event.target).value)" placeholder="Reference, type or method" />
        </mat-form-field>
        <div class="filter-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Type</mat-label>
            <mat-select [value]="vm.typeFilter()" (selectionChange)="setType($event.value)">
              <mat-option value="">All types</mat-option>
              @for (t of vm.types(); track t) {
                <mat-option [value]="t">{{ t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [value]="vm.statusFilter()" (selectionChange)="setStatus($event.value)">
              <mat-option value="">All statuses</mat-option>
              @for (s of vm.statuses(); track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      @if (vm.loading()) {
        <async-page-skeleton layout="list" [rows]="5" label="wallet history" [showHeader]="false" />
      }

      @if (vm.error(); as err) {
        <async-mobile-card>
          <p class="error" role="alert">{{ err }}</p>
          <button mat-stroked-button type="button" (click)="vm.reload()">Try again</button>
        </async-mobile-card>
      }

      @if (!vm.loading() && !vm.error()) {
        @if (vm.filtered().length === 0) {
          <async-mobile-card>
            <div class="empty">
              <mat-icon aria-hidden="true">receipt_long</mat-icon>
              <strong>No transactions{{ vm.hasFilters() ? ' match these filters' : ' yet' }}</strong>
              <p>{{ vm.hasFilters() ? 'Clear the filters to see the full ledger.' : 'Deposits and purchases will land here.' }}</p>
            </div>
          </async-mobile-card>
        } @else {
          <div class="tx-list">
            @for (row of vm.paged(); track row.id) {
              <async-mobile-card class="tx-card">
                <div class="tx-top">
                  <span class="tx-icon" [class.is-credit]="vm.isCreditRow(row)">
                    <mat-icon aria-hidden="true">{{ vm.isCreditRow(row) ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
                  </span>
                  <span class="tx-copy">
                    <strong>{{ row.type || row.method || 'Transaction' }}</strong>
                    <small>{{ row.at ? (row.at | date:'medium') : 'No date' }}</small>
                  </span>
                  <span class="tx-amount" [class.is-credit]="vm.isCreditRow(row)">{{ vm.amountText(row) }}</span>
                </div>
                <div class="tx-bottom">
                  <async-status-chip [label]="row.status" [tone]="tone(row.status)" />
                  <span class="tx-ref">{{ row.reference || 'No reference' }}</span>
                </div>
              </async-mobile-card>
            }
          </div>

          <div class="pager">
            <button mat-stroked-button type="button" (click)="prev()" [disabled]="vm.pageIndex() === 0">Previous</button>
            <span>{{ rangeLabel() }}</span>
            <button mat-stroked-button type="button" (click)="next()" [disabled]="vm.pageIndex() + 1 >= pageCount()">Next</button>
          </div>

          @if (vm.hasMore()) {
            <button mat-stroked-button type="button" class="load-more" (click)="vm.loadMore()" [disabled]="vm.loadingMore()">
              {{ vm.loadingMore() ? 'Loading more…' : 'Load more transactions' }}
            </button>
          }
        }
      }
    </async-mobile-page-shell>
  `,
  styles: [`
    .intro {
      margin: 0 0 12px;
      color: var(--ms-text-muted);
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .filters {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .filter-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .tx-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tx-card {
      padding: 12px;
    }

    .tx-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tx-icon {
      display: inline-grid;
      width: 34px;
      height: 34px;
      flex: none;
      place-items: center;
      border-radius: 50%;
      background: var(--ms-error-soft);
      color: var(--ms-error);
    }

    .tx-icon.is-credit {
      background: var(--ms-success-soft);
      color: var(--ms-success);
    }

    .tx-icon mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .tx-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .tx-copy strong {
      overflow: hidden;
      font-size: 0.84rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-copy small {
      overflow: hidden;
      color: var(--ms-text-muted);
      font-size: 0.7rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-amount {
      flex: none;
      color: var(--ms-error);
      font-size: 0.82rem;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      white-space: nowrap;
    }

    .tx-amount.is-credit {
      color: var(--ms-success);
    }

    .tx-bottom {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--ms-line);
    }

    .tx-ref {
      overflow: hidden;
      color: var(--ms-text-muted);
      font-family: var(--ms-font-mono);
      font-size: 0.65rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 12px;
      color: var(--ms-text-muted);
      font-size: 0.72rem;
    }

    .pager button {
      min-height: 44px;
    }

    .load-more {
      width: 100%;
      min-height: 44px;
      margin-top: 8px;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 0;
      text-align: center;
    }

    .empty mat-icon {
      color: var(--ms-primary-strong);
      font-size: 30px;
      width: 30px;
      height: 30px;
    }

    .empty strong {
      font-size: 0.9rem;
    }

    .empty p {
      margin: 0;
      color: var(--ms-text-muted);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .error {
      margin: 0 0 8px;
      color: var(--ms-error);
      font-size: 0.8rem;
    }
  `],
})
export class WalletHistoryMobileComponent implements OnInit {
  protected readonly vm = inject(WalletHistoryFacade);

  protected readonly pageCount = computed(() => (
    Math.max(Math.ceil(this.vm.filtered().length / this.vm.pageSize()), 1)
  ));

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }

  protected setQuery(value: string): void {
    this.vm.query.set(String(value ?? ''));
    this.vm.setPage(0, this.vm.pageSize());
  }

  protected setType(value: string): void {
    this.vm.typeFilter.set(String(value ?? ''));
    this.vm.setPage(0, this.vm.pageSize());
  }

  protected setStatus(value: string): void {
    this.vm.statusFilter.set(String(value ?? ''));
    this.vm.setPage(0, this.vm.pageSize());
  }

  protected tone(status: string): StatusTone {
    const cls = this.vm.statusTone(status);
    if (cls.endsWith('ok')) return 'success';
    if (cls.endsWith('warn')) return 'warning';
    if (cls.endsWith('bad')) return 'danger';
    return 'info';
  }

  protected rangeLabel(): string {
    const total = this.vm.filtered().length;
    if (total === 0) return '0 of 0';
    const start = this.vm.pageIndex() * this.vm.pageSize() + 1;
    const end = Math.min(start + this.vm.pageSize() - 1, total);
    return `${start}–${end} of ${total}`;
  }

  protected prev(): void {
    this.vm.setPage(Math.max(this.vm.pageIndex() - 1, 0), this.vm.pageSize());
  }

  protected next(): void {
    this.vm.setPage(Math.min(this.vm.pageIndex() + 1, this.pageCount() - 1), this.vm.pageSize());
  }
}
