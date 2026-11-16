import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletHistoryFacade } from '../state/wallet-history.facade';

@Component({
  selector: 'async-wallet-history-desktop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSelectModule, MatTableModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/wallet">Wallet</a> &gt;
        <span>History</span>
      </div>
    </section>

    <section class="history-page">
      <div class="page-head">
        <div>
          <h2>Transaction history</h2>
          <p class="subtitle">Deposits, purchases, refunds and adjustments — newest first.</p>
        </div>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value); pageIndex.set(0)" placeholder="Reference, type or method" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Type</mat-label>
          <mat-select [value]="typeFilter()" (selectionChange)="typeFilter.set($event.value); pageIndex.set(0)">
            <mat-option value="">All types</mat-option>
            @for (t of types(); track t) {
              <mat-option [value]="t">{{ t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="statusFilter()" (selectionChange)="statusFilter.set($event.value); pageIndex.set(0)">
            <mat-option value="">All statuses</mat-option>
            @for (s of statuses(); track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="table" [rows]="6" label="wallet history" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (paged().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="paged()" class="mat-elevation-z2">
            <ng-container matColumnDef="at">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let row">{{ row.at ? (row.at | date:'medium') : '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let row">{{ row.type }}</td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let row" class="num" [class.credit]="isCreditRow(row)">{{ amountText(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row"><span class="dp-status {{ statusTone(row.status) }}">{{ row.status }}</span></td>
            </ng-container>
            <ng-container matColumnDef="ref">
              <th mat-header-cell *matHeaderCellDef>Reference</th>
              <td mat-cell *matCellDef="let row" class="mono">{{ row.reference || '—' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <mat-paginator
            [length]="filtered().length"
            [pageSize]="pageSize()"
            [pageIndex]="pageIndex()"
            [pageSizeOptions]="[25, 50, 100]"
            (page)="onPage($event)"
          ></mat-paginator>
          @if (hasMore()) {
            <div class="load-more-row">
              <button mat-stroked-button type="button" (click)="loadMore()" [disabled]="loadingMore()">
                <mat-icon>{{ loadingMore() ? 'hourglass_top' : 'expand_more' }}</mat-icon>
                {{ loadingMore() ? 'Loading more.' : 'Load more transactions' }}
              </button>
            </div>
          }
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No transactions{{ hasFilters() ? ' match these filters' : ' yet — deposits and purchases will land here' }}.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .history-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 8px 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .toolbar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 200px; }
    .table-wrap { overflow-x: auto; border-radius: var(--ms-radius-sm); }
    table { width: 100%; }
    .num { font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .num.credit { color: var(--ms-success); }
    .mono { font-family: var(--ms-font-mono); font-size: 0.8125rem; }
    .muted { color: var(--ms-text-muted); font-size: 0.875rem; }
    .empty { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 8px; }
    .load-more-row { display: flex; justify-content: center; padding: 16px 0 8px; }
    button { min-height: 44px; }
  `],
})
export class WalletHistoryDesktopComponent implements OnInit {
  private readonly facade = inject(WalletHistoryFacade);

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected readonly loading = this.facade.loading;
  protected readonly loadingMore = this.facade.loadingMore;
  protected readonly hasMore = this.facade.hasMore;
  protected readonly error = this.facade.error;
  protected readonly query = this.facade.query;
  protected readonly typeFilter = this.facade.typeFilter;
  protected readonly statusFilter = this.facade.statusFilter;
  protected readonly pageIndex = this.facade.pageIndex;
  protected readonly pageSize = this.facade.pageSize;
  protected readonly types = this.facade.types;
  protected readonly statuses = this.facade.statuses;
  protected readonly filtered = this.facade.filtered;
  protected readonly paged = this.facade.paged;
  protected readonly displayedColumns = ['at', 'type', 'amount', 'status', 'ref'];

  protected hasFilters(): boolean {
    return this.facade.hasFilters();
  }

  protected isCreditRow(row: Parameters<WalletHistoryFacade['isCreditRow']>[0]): boolean {
    return this.facade.isCreditRow(row);
  }

  protected amountText(row: Parameters<WalletHistoryFacade['amountText']>[0]): string {
    return this.facade.amountText(row);
  }

  protected statusTone(status: string): string {
    return this.facade.statusTone(status);
  }

  protected onPage(event: PageEvent): void {
    this.facade.setPage(event.pageIndex, event.pageSize);
  }

  protected reload(): void {
    this.facade.reload();
  }

  protected loadMore(): void {
    this.facade.loadMore();
  }
}
