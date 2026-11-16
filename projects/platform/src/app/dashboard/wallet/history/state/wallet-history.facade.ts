import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WalletService } from '../../../../core/wallet/wallet.service';
import { WalletTransaction } from '../../../../core/wallet/wallet.models';
import { ApiError } from '../../../../core/http/api-error';
import { formatSignedMoney, isWalletCredit } from '../../../../core/format/money';

/** Shared wallet-history filters, pagination and loading state. */
@Injectable()
export class WalletHistoryFacade {
  private readonly wallet = inject(WalletService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<WalletTransaction[]>([]);
  readonly query = signal('');
  readonly typeFilter = signal('');
  readonly statusFilter = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  private nextSkip = 0;
  private started = false;

  readonly types = computed(() => [...new Set(this.rows().map((r) => r.type))].sort());
  readonly statuses = computed(() => [...new Set(this.rows().map((r) => r.status))].sort());

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (this.typeFilter() && r.type !== this.typeFilter()) return false;
      if (this.statusFilter() && r.status !== this.statusFilter()) return false;
      if (q && ![r.reference, r.type, r.method, String(r.amount)].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly paged = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  hasFilters(): boolean {
    return this.query().trim() !== '' || this.typeFilter() !== '' || this.statusFilter() !== '';
  }

  isCreditRow(row: WalletTransaction): boolean {
    return isWalletCredit(row);
  }

  amountText(row: WalletTransaction): string {
    return formatSignedMoney(row.amount, isWalletCredit(row));
  }

  statusTone(status: string): string {
    const s = String(status ?? '').toLowerCase();
    if (/complet|success|paid|approved|released|credit/.test(s)) return 'dp-status--ok';
    if (/pend|process/.test(s)) return 'dp-status--warn';
    if (/fail|reject|cancel|void|revers/.test(s)) return 'dp-status--bad';
    return 'dp-status--info';
  }

  setPage(pageIndex: number, pageSize: number): void {
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.nextSkip = 0;
    this.wallet
      .historyPage({ limit: 100, skip: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set([...res.data].sort((a, b) =>
            new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()));
          this.nextSkip = res.data.length;
          this.hasMore.set(res.meta?.hasMore === true);
          this.pageIndex.set(0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.wallet.historyPage({ limit: 100, skip: this.nextSkip })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const seen = new Set(this.rows().map((row) => row.id));
          this.rows.update((current) => [
            ...current,
            ...res.data.filter((row) => !seen.has(row.id)),
          ]);
          this.nextSkip += res.data.length;
          this.hasMore.set(res.meta?.hasMore === true);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }
}
