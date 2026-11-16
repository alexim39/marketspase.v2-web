import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CompensationService } from '../../../core/compensation/compensation.service';
import { ProgressionService } from '../../../core/progression/progression.service';
import { StoreService } from '../../../core/store/store.service';
import { Journey } from '../../../core/progression/progression.models';
import { MentorBonus, MyCompensation } from '../../../core/compensation/compensation.models';
import { StoreEarnings } from '../../../core/store/store.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { formatMoney } from '../../../core/format/money';

/** Shared compensation state, simulator and statement export. */
@Injectable()
export class CompensationFacade {
  private readonly service = inject(CompensationService);
  private readonly progression = inject(ProgressionService);
  private readonly store = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<MyCompensation | null>(null);
  readonly journey = signal<Journey | null>(null);
  readonly storeEarnings = signal<StoreEarnings | null>(null);
  readonly simulatedMargin = signal(100000);
  private started = false;

  readonly productEntries = computed(() => this.data()?.entries.filter((e) => e.saleType !== 'activation') ?? []);
  readonly activationEntries = computed(() => this.data()?.entries.filter((e) => e.saleType === 'activation') ?? []);

  readonly lifetimeEarned = computed(() => {
    const me = this.data();
    return Number(me?.summary.released ?? 0) + Number(me?.summary.mentorPaid ?? 0) + Number(this.storeEarnings()?.released ?? 0);
  });
  readonly pendingTotal = computed(() => {
    const me = this.data();
    return Number(me?.summary.pending ?? 0) + Number(this.storeEarnings()?.pending ?? 0);
  });

  readonly productReleased = computed(() => this.sumEntries(this.productEntries(), 'Released'));
  readonly productPending = computed(() => this.sumEntries(this.productEntries(), 'Pending'));
  readonly activationReleased = computed(() => this.sumEntries(this.activationEntries(), 'Released'));
  readonly activationPending = computed(() => this.sumEntries(this.activationEntries(), 'Pending'));
  readonly scheduledBonus = computed(() => (this.data()?.mentorBonuses ?? []).filter((b) => b.status === 'scheduled').length);
  readonly payableRates = computed(() => {
    const me = this.data();
    if (!me) return [];
    return me.plan.rates.filter((rate) => rate.level <= me.partner.depth);
  });
  readonly simulatedCommission = computed(() => {
    const me = this.data();
    const rates = this.payableRates();
    if (!me || rates.length === 0) return 0;
    const margin = Math.max(0, Number(this.simulatedMargin()) || 0);
    const perLevel = margin / rates.length;
    return rates.reduce((sum, rate) => sum + perLevel * rate.rate, 0);
  });

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    forkJoin({
      compensation: this.service.me(),
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      store: this.store.earnings().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ compensation, journey, store }) => {
        this.data.set(compensation.data);
        this.journey.set(journey?.data ?? null);
        this.storeEarnings.set(store?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  setSimulatedMargin(value: number): void {
    this.simulatedMargin.set(Number.isFinite(value) ? Math.max(0, value) : 0);
  }

  bonusLabel(bonus: MentorBonus): string {
    if (bonus.status === 'scheduled') return 'Scheduled';
    if (bonus.status === 'paid') return 'Paid';
    if (bonus.status === 'clawed_back') return 'Clawed back';
    if (bonus.status === 'cancelled') return 'Cancelled';
    return 'Forfeited';
  }

  money(value: number): string {
    return formatMoney(value, 0);
  }

  downloadStatement(): void {
    const me = this.data();
    if (!me) return;
    const rows: Array<Array<string | number>> = [
      ['Date', 'Source', 'Sale type', 'Level', 'Rate', 'Gross margin', 'Commission', 'Status'],
      ...me.entries.map((entry) => [
        new Date(entry.createdAt).toISOString().slice(0, 10),
        `${entry.buyer?.name ?? 'Partner'}${entry.buyer?.username ? ` (@${entry.buyer.username})` : ''}`,
        entry.saleType ?? 'activation',
        entry.level,
        `${Math.round(entry.rate * 1000) / 10}%`,
        entry.grossMargin,
        entry.amount,
        entry.status,
      ]),
      ...me.mentorBonuses.map((bonus) => [
        new Date(bonus.dueAt).toISOString().slice(0, 10),
        `Mentor bonus — ${bonus.activationPartner?.name ?? 'Placed partner'}`,
        'mentor bonus',
        '',
        '',
        '',
        bonus.amount,
        bonus.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketspase-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private sumEntries(entries: MyCompensation['entries'], status: 'Released' | 'Pending'): number {
    return entries.filter((entry) => entry.status === status).reduce((sum, entry) => sum + entry.amount, 0);
  }
}
