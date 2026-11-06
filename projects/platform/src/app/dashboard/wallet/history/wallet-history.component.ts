import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletService } from '../../../core/wallet/wallet.service';
import { WalletTransaction } from '../../../core/wallet/wallet.models';
import { ApiError } from '../../../core/http/api-error';
import { formatSignedMoney, isWalletCredit } from '../../../core/format/money';

/**
 * @title Transaction history — every naira, filterable.
 *
 * Reads the member's own transaction rows (newest first, client-paged —
 * per-member volumes stay small). Type/status/search filters compose.
 * OnPush + signals, in-card scroll on mobile.
 */
@Component({
  selector: 'async-wallet-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, MatSelectModule, MatTableModule, PageSkeletonComponent, RouterModule],
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
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No transactions{{ hasFilters() ? ' match these filters' : ' yet — deposits and purchases will land here' }}.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .history-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 200px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .num { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .num.credit { color: var(--ms-success); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .empty { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    button { min-height: 44px; }
  `],
})
export class WalletHistoryComponent implements OnInit {
  private readonly wallet = inject(WalletService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<WalletTransaction[]>([]);
  protected readonly query = signal('');
  protected readonly typeFilter = signal('');
  protected readonly statusFilter = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);

  protected readonly displayedColumns = ['at', 'type', 'amount', 'status', 'ref'];

  protected readonly types = computed(() => [...new Set(this.rows().map((r) => r.type))].sort());
  protected readonly statuses = computed(() => [...new Set(this.rows().map((r) => r.status))].sort());

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (this.typeFilter() && r.type !== this.typeFilter()) return false;
      if (this.statusFilter() && r.status !== this.statusFilter()) return false;
      if (q && ![r.reference, r.type, r.method, String(r.amount)].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected readonly paged = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.reload();
  }

  protected hasFilters(): boolean {
    return this.query().trim() !== '' || this.typeFilter() !== '' || this.statusFilter() !== '';
  }

  protected isCreditRow(row: WalletTransaction): boolean {
    return isWalletCredit(row);
  }

  protected amountText(row: WalletTransaction): string {
    return formatSignedMoney(row.amount, isWalletCredit(row));
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected statusTone(status: string): string {
    const s = String(status ?? '').toLowerCase();
    if (/complet|success|paid|approved|released|credit/.test(s)) return 'dp-status--ok';
    if (/pend|process/.test(s)) return 'dp-status--warn';
    if (/fail|reject|cancel|void|revers/.test(s)) return 'dp-status--bad';
    return 'dp-status--info';
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.wallet
      .history()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set([...rows].sort((a, b) =>
            new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()));
          this.pageIndex.set(0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
