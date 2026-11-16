import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoreService } from '../../../../../core/store/store.service';
import { StoreCustomerLead } from '../../../../../core/store/store.models';
import { ApiError, userError } from '../../../../../core/http/api-error';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Closed'] as const;

/** Shared customer-lead CRM state and outreach actions. */
@Injectable()
export class CustomerLeadsFacade {
  private readonly store = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUSES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly rows = signal<StoreCustomerLead[]>([]);
  readonly total = signal(0);
  readonly summary = signal<{
    totalLeads: number; repeatCustomers: number; paidOrders: number; revenue: number; newThisMonth: number;
    segments?: { new: number; repeat: number; dormant: number; loyal: number };
  } | null>(null);
  readonly query = signal('');
  readonly status = signal('');
  readonly segment = signal<'all' | 'new' | 'repeat' | 'dormant' | 'loyal'>('all');
  readonly pageIndex = signal(0);
  readonly pageSize = 50;
  readonly selected = signal<StoreCustomerLead | null>(null);
  readonly draftStatus = signal<StoreCustomerLead['status']>('New');
  readonly draftNotes = signal('');
  readonly hasNext = computed(() => this.pageIndex() + this.pageSize < this.total());
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.store.customerLeads({
      q: this.query().trim(),
      status: this.status() || undefined,
      segment: this.segment(),
      limit: this.pageSize,
      skip: this.pageIndex() * this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.summary.set(res.meta?.summary ?? null);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  setSegment(value: 'all' | 'new' | 'repeat' | 'dormant' | 'loyal'): void {
    this.segment.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  prevPage(): void {
    if (this.pageIndex() === 0) return;
    this.pageIndex.update((p) => Math.max(0, p - 1));
    this.load();
  }

  nextPage(): void {
    if (!this.hasNext()) return;
    this.pageIndex.update((p) => p + 1);
    this.load();
  }

  select(row: StoreCustomerLead): void {
    this.selected.set(row);
    this.draftStatus.set(row.status);
    this.draftNotes.set(row.partnerNotes ?? '');
    this.notice.set(null);
  }

  save(): void {
    const customer = this.selected();
    if (!customer || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.store.updateCustomerLead(customer.id, {
      status: this.draftStatus(),
      partnerNotes: this.draftNotes(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notice.set('Customer updated.');
        const fresh = res.data;
        this.rows.update((rows) => rows.map((row) => (row.id === fresh.id ? fresh : row)));
        this.selected.set(fresh);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.error.set(userError(err));
      },
    });
  }

  initial(row: StoreCustomerLead): string {
    return String(row.name || row.email || 'C').trim().charAt(0).toUpperCase();
  }

  recordOutreach(row: StoreCustomerLead, channel: 'whatsapp' | 'email' | 'call'): void {
    this.store.recordCustomerOutreach(row.id, channel)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const fresh = res.data;
          this.rows.update((rows) => rows.map((item) => (item.id === fresh.id ? fresh : item)));
          if (this.selected()?.id === fresh.id) this.selected.set(fresh);
        },
        error: () => { /* tracking is best-effort */ },
      });
  }

  segmentFor(row: StoreCustomerLead): { label: string; tone: 'new' | 'repeat' | 'loyal' | 'dormant' } {
    if (this.isReorderDue(row)) return { label: 'Reorder due', tone: 'dormant' };
    if (row.paidOrders >= 3) return { label: 'Loyal', tone: 'loyal' };
    if (row.paidOrders >= 2) return { label: 'Repeat', tone: 'repeat' };
    if (row.paidOrders >= 1) return { label: 'Customer', tone: 'new' };
    return { label: 'New lead', tone: 'new' };
  }

  isReorderDue(row: StoreCustomerLead): boolean {
    if (!row.lastPaidAt || row.paidOrders < 1) return false;
    const last = new Date(row.lastPaidAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last >= 60 * 86400000;
  }

  averageOrder(row: StoreCustomerLead): string {
    if (!row.paidOrders) return '—';
    return `₦${(row.totalSpent / row.paidOrders).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }

  reorderText(row: StoreCustomerLead): string {
    if (!row.lastPaidAt) return 'No paid order yet — keep the first conversation warm.';
    const last = new Date(row.lastPaidAt).getTime();
    if (Number.isNaN(last)) return 'Last order date unavailable.';
    const days = Math.floor((Date.now() - last) / 86400000);
    if (this.isReorderDue(row)) return `Reorder due — last order was ${days} day${days === 1 ? '' : 's'} ago.`;
    const next = new Date(last + 60 * 86400000);
    return `Next reorder check-in after ${next.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}.`;
  }

  reorderMessage(row: StoreCustomerLead): string {
    const first = String(row.name || 'there').trim().split(/\s+/)[0] || 'there';
    return `Hi ${first}, it has been a while since your last order. Would you like me to help you restock or recommend something that fits what you bought before?`;
  }

  whatsapp(phone: string, name = '', message = ''): string {
    const digits = String(phone ?? '').replace(/\D/g, '').replace(/^0/, '234');
    const text = message || `Hi ${String(name || 'there').trim().split(/\s+/)[0] || 'there'}, just checking in. How can I help with your next order?`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  email(row: StoreCustomerLead, message = ''): string {
    const subject = encodeURIComponent('Checking in from MarketSpase');
    const body = encodeURIComponent(message || `Hi ${String(row.name || 'there').trim().split(/\s+/)[0] || 'there'}, just checking in. How can I help with your next order?`);
    return `mailto:${row.email}?subject=${subject}&body=${body}`;
  }
}
