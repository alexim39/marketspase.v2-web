import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import {
  AdminFinanceService,
  FinanceTransactionType,
} from '../../../core/finance/admin-finance.service';
import {
  AdminFinanceTransaction,
  AdminFinanceTransactionList,
} from '../../../core/finance/admin-finance.models';
import { ApiError, userError } from '../../../core/http/api-error';

type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';

@Component({
  selector: 'async-admin-finance-transactions',
  templateUrl: './admin-finance-transactions.component.html',
  styleUrls: ['./admin-finance-transactions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    PageSkeletonComponent,
  ],
})
export class AdminFinanceTransactionsComponent implements OnInit {
  private readonly finance = inject(AdminFinanceService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<AdminFinanceTransactionList | null>(null);
  protected readonly type = signal<FinanceTransactionType>('all');
  protected readonly status = signal('');
  protected readonly rangeDays = signal(30);
  protected readonly page = signal(0);
  protected readonly pageSize = 25;
  protected readonly expanded = signal<string | null>(null);
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private requestSeq = 0;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil((this.data()?.total ?? 0) / this.pageSize)));
  protected readonly rangeStart = computed(() => {
    const list = this.data();
    return list && list.total > 0 ? list.skip + 1 : 0;
  });
  protected readonly rangeEnd = computed(() => {
    const list = this.data();
    return list ? Math.min(list.skip + list.items.length, list.total) : 0;
  });

  protected readonly typeOptions: Array<{ value: FinanceTransactionType; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'deposits', label: 'Deposits' },
    { value: 'withdrawals', label: 'Withdrawals' },
    { value: 'refunds', label: 'Refunds' },
  ];
  protected readonly statusOptions = ['', 'Completed', 'Paid', 'Pending', 'Rejected', 'Failed'];
  protected readonly rangeOptions = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 0, label: 'All time' },
  ];

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        void this.load();
      });
    void this.load();
  }

  protected setType(type: FinanceTransactionType): void {
    if (this.type() === type) return;
    this.type.set(type);
    this.page.set(0);
    void this.load();
  }

  protected setStatus(status: string): void {
    if (this.status() === status) return;
    this.status.set(status);
    this.page.set(0);
    void this.load();
  }

  protected setRange(days: number): void {
    if (this.rangeDays() === days) return;
    this.rangeDays.set(days);
    this.page.set(0);
    void this.load();
  }

  protected clearSearch(): void {
    if (!this.searchControl.value) return;
    this.searchControl.setValue('');
  }

  protected resetFilters(): void {
    this.type.set('all');
    this.status.set('');
    this.rangeDays.set(30);
    this.searchControl.setValue('', { emitEvent: false });
    this.page.set(0);
    void this.load();
  }

  protected toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  protected goPage(delta: number): void {
    const next = this.page() + delta;
    if (next < 0 || next >= this.pageCount() || this.loading()) return;
    this.page.set(next);
    this.expanded.set(null);
    void this.load();
  }

  protected typeLabel(item: AdminFinanceTransaction): string {
    if (item.method === 'Withdrawal') return 'Withdrawal';
    if (item.method === 'Withdrawal Refund') return 'Withdrawal refund';
    if (item.method === 'Admin Credit') return 'Admin credit';
    return 'Deposit';
  }

  protected statusTone(status: string): Tone {
    const value = String(status ?? '').toLowerCase();
    if (['completed', 'paid', 'success', 'successful'].includes(value)) return 'ok';
    if (['pending', 'processing', 'queued'].includes(value)) return 'warn';
    if (['rejected', 'failed', 'reversed', 'cancelled', 'refunded'].includes(value)) return 'danger';
    return 'neutral';
  }

  protected isWithdrawal(item: AdminFinanceTransaction): boolean {
    return item.method === 'Withdrawal';
  }

  protected isRefund(item: AdminFinanceTransaction): boolean {
    return item.method === 'Withdrawal Refund';
  }

  protected hasDetails(item: AdminFinanceTransaction): boolean {
    return this.isWithdrawal(item)
      || this.isRefund(item)
      || Boolean(item.bank || item.accountName || item.accountLast4 || item.reference);
  }

  protected partnerLabel(item: AdminFinanceTransaction): string {
    return item.partnerName?.trim() || item.partnerUsername || item.partnerEmail || 'Unknown partner';
  }

  private async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const from = this.rangeDays() > 0
        ? new Date(Date.now() - this.rangeDays() * 24 * 60 * 60 * 1000)
        : null;
      const response = await new Promise<AdminFinanceTransactionList>((resolve, reject) => {
        this.finance.transactions({
          type: this.type(),
          status: this.status(),
          q: this.searchControl.value.trim(),
          from,
          limit: this.pageSize,
          skip: this.page() * this.pageSize,
        }).subscribe({
          next: (res) => resolve(res.data),
          error: reject,
        });
      });
      if (seq !== this.requestSeq) return;
      this.data.set(response);
    } catch (err) {
      if (seq !== this.requestSeq) return;
      this.error.set(userError(err as ApiError));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }
}
