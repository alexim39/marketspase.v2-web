import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { TransactionInterface } from '../paystack.service';

interface TransactionRow {
  reference?: string;
  date?: string | Date;
  amount?: number;
  bonusAmount?: number;
  paymentMethod?: string;
  transactionType?: string;
  status?: string;
  paymentStatus?: boolean;
}

/**
 * Transaction history with a desktop table and a mobile card timeline.
 * The same search and page state drive both presentations.
 */
@Component({
  selector: 'async-transactions',
  styleUrls: ['transactions.component.scss'],
  templateUrl: 'transactions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
  ],
})
export class TransactionsComponent implements OnInit, OnChanges {
  @Input() partner!: PartnerInterface;
  @Input() transactions!: TransactionInterface;

  protected readonly displayedColumns = [
    'transactionId',
    'dateOfPayment',
    'amount',
    'paymentStatus',
    'action',
  ];
  protected readonly pageSize = 10;

  protected readonly rows = signal<TransactionRow[]>([]);
  protected readonly query = signal('');
  protected readonly page = signal(0);

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const all = this.rows();
    if (!needle) return all;
    return all.filter((row) => [
      row.reference,
      row.paymentMethod,
      row.transactionType,
      row.status,
      String(row.amount ?? ''),
      row.date ? new Date(row.date).toISOString() : '',
    ].some((value) => String(value ?? '').toLowerCase().includes(needle)));
  });

  protected readonly pageCount = computed(() => (
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  ));

  protected readonly paged = computed(() => {
    const page = Math.min(this.page(), this.pageCount() - 1);
    const start = page * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  protected readonly rangeStart = computed(() => (
    this.filtered().length === 0 ? 0 : Math.min(this.page(), this.pageCount() - 1) * this.pageSize + 1
  ));

  protected readonly rangeEnd = computed(() => (
    Math.min(
      (Math.min(this.page(), this.pageCount() - 1) + 1) * this.pageSize,
      this.filtered().length,
    )
  ));

  ngOnInit(): void {
    this.loadRows();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions']) this.loadRows();
  }

  private loadRows(): void {
    const data = (this.transactions?.data ?? []) as TransactionRow[];
    this.rows.set(
      data
        .slice()
        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
    );
    this.page.set(0);
  }

  protected onFilter(value: string): void {
    this.query.set(value);
    this.page.set(0);
  }

  protected prevPage(): void {
    this.page.update((page) => Math.max(0, page - 1));
  }

  protected nextPage(): void {
    this.page.update((page) => Math.min(this.pageCount() - 1, page + 1));
  }

  protected isCredit(row: TransactionRow): boolean {
    return String(row.transactionType ?? '').toLowerCase() === 'credit';
  }

  protected isDebit(row: TransactionRow): boolean {
    return String(row.transactionType ?? '').toLowerCase() === 'debit';
  }

  protected iconFor(row: TransactionRow): string {
    if (this.isCredit(row)) return 'south_west';
    if (this.isDebit(row)) return 'north_east';
    return 'swap_horiz';
  }

  protected titleFor(row: TransactionRow): string {
    const method = String(row.paymentMethod ?? '').trim();
    return method || String(row.transactionType ?? '').trim() || 'Wallet transaction';
  }

  protected statusLabel(row: TransactionRow): string {
    const status = String(row.status ?? '').trim();
    if (status) return status;
    return row.paymentStatus ? 'Completed' : 'Pending';
  }

  protected statusClass(row: TransactionRow): string {
    const status = this.statusLabel(row).toLowerCase();
    if (['completed', 'success', 'paid', 'released'].includes(status)) return 'is-success';
    if (['pending', 'processing', 'queued', 'scheduled'].includes(status)) return 'is-pending';
    if (['rejected', 'failed', 'reversed', 'cancelled', 'voided'].includes(status)) return 'is-error';
    return 'is-neutral';
  }

  protected amountPrefix(row: TransactionRow): string {
    if (this.isCredit(row)) return '+';
    if (this.isDebit(row)) return '−';
    return '';
  }

  protected download(row: TransactionRow): void {
    if (typeof document === 'undefined') return;
    const lines = [
      'MarketSpase transaction receipt',
      `Reference,${row.reference ?? ''}`,
      `Date,${row.date ? new Date(row.date).toISOString() : ''}`,
      `Type,${row.transactionType ?? ''}`,
      `Method,${row.paymentMethod ?? ''}`,
      `Amount,${Number(row.amount ?? 0).toFixed(2)}`,
      `Status,${this.statusLabel(row)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketspase-${row.reference ?? 'transaction'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
