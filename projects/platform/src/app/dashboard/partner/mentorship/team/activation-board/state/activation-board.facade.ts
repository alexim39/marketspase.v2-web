import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeadPipelineService } from '../../../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoardItem } from '../../../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../../../core/http/api-error';

type BoardFilter = 'all' | 'needs' | 'done';
const PAGE_SIZE = 10;

/** Shared activation board data, filters, pagination and check-ins. */
@Injectable()
export class ActivationBoardFacade {
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<ActivationBoardItem[]>([]);
  readonly totalMembers = signal(0);
  readonly query = signal('');
  readonly filter = signal<BoardFilter>('all');
  readonly page = signal(0);
  readonly checkinId = signal<string | null>(null);
  readonly checkinNote = signal('');
  readonly checkinBusy = signal(false);
  private started = false;

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.items().filter((m) => {
      const done = this.isDone(m);
      if (f === 'needs' && done) return false;
      if (f === 'done' && !done) return false;
      if (!q) return true;
      return `${m.member?.name ?? ''} ${m.member?.username ?? ''}`.toLowerCase().includes(q);
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly paged = computed(() => {
    const p = Math.min(this.page(), this.totalPages() - 1);
    return this.filtered().slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  });

  readonly needWorkCount = computed(() => this.items().filter((m) => !this.isDone(m)).length);
  readonly completedCount = computed(() => this.items().filter((m) => this.isDone(m)).length);
  readonly atRiskCount = computed(() => this.items().filter((m) => m.playbook?.atRisk).length);

  readonly completionRate = computed(() => {
    const total = this.items().length;
    if (!total) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  doneCount(m: ActivationBoardItem): number {
    return [m.ipoDone, m.qsgDone, m.smoDone].filter(Boolean).length;
  }

  progressPct(m: ActivationBoardItem): number {
    return Math.round((this.doneCount(m) / 3) * 100);
  }

  initials(name?: string | null): string {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TM';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return `${first}${last}`.toUpperCase();
  }

  isDone(m: ActivationBoardItem): boolean {
    return m.ipoDone && m.qsgDone && m.smoDone;
  }

  toneClass(tone: ActivationBoardItem['nextTone']): string {
    switch (tone) {
      case 'bad': return 'dp-status--bad';
      case 'warn': return 'dp-status--warn';
      case 'info': return 'dp-status--info';
      default: return 'dp-status--ok';
    }
  }

  prev(): void { this.page.update((p) => Math.max(0, p - 1)); }
  next(): void { this.page.update((p) => Math.min(this.totalPages() - 1, p + 1)); }

  clearSearch(): void {
    this.query.set('');
    this.filter.set('all');
    this.page.set(0);
  }

  checkinLabel(kind: string | null): string {
    if (kind === 'welcome') return 'welcome call';
    if (kind === 'day3') return 'day 3 check-in';
    if (kind === 'day7') return 'day 7 review';
    return 'check-in';
  }

  startCheckin(m: ActivationBoardItem): void {
    this.checkinId.set(m.partnerId);
    this.checkinNote.set('');
  }

  cancelCheckin(): void {
    this.checkinId.set(null);
    this.checkinNote.set('');
    this.checkinBusy.set(false);
  }

  saveCheckin(m: ActivationBoardItem): void {
    if (this.checkinBusy()) return;
    const kind = (m.playbook?.checkins.nextKind ?? 'ad_hoc') as 'welcome' | 'day3' | 'day7' | 'ad_hoc';
    this.checkinBusy.set(true);
    this.leads.recordMentorCheckin(m.partnerId, kind, this.checkinNote())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.checkinBusy.set(false);
          this.checkinId.set(null);
          this.checkinNote.set('');
          this.reload();
        },
        error: (err: ApiError) => {
          this.checkinBusy.set(false);
          this.error.set(err.message);
        },
      });
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads.activationBoard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.items.set(res.data?.items ?? []);
          this.totalMembers.set(res.data?.total ?? (res.data?.items ?? []).length);
          this.page.set(0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
