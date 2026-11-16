import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { PresenceService, PresenceStatus } from '../../../../../core/presence/presence.service';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { userError } from '../../../../../core/http/api-error';
import { MyPartnersService } from '../my-partners.service';

export interface PartnerActivationInfo {
  levelLabel?: string;
  relation?: string;
  ipoDone?: boolean;
  qsgDone?: boolean;
  smoDone?: boolean;
  worked?: number;
  total?: number;
  unworked?: number;
  overdue?: boolean;
}

/** Shared direct-partner list, activation stamps, filters and presence. */
@Injectable()
export class MyPartnersFacade {
  private readonly partnerService = inject(PartnerService);
  private readonly myPartnersService = inject(MyPartnersService);
  private readonly leads = inject(LeadPipelineService);
  private readonly presence = inject(PresenceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly partner = signal<PartnerInterface | null>(null);
  readonly partners = signal<PartnerInterface[]>([]);
  readonly supportMap = signal<Record<string, PartnerActivationInfo>>({});
  readonly presenceMap = signal<Record<string, string | null>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly filterText = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = 10;
  private started = false;

  readonly filteredPartners = computed(() => {
    const q = this.filterText().trim().toLowerCase();
    if (!q) return this.partners();
    return this.partners().filter((p) => [p.name, p.surname, p.username]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)));
  });

  readonly totalFiltered = computed(() => this.filteredPartners().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalFiltered() / this.pageSize)));

  readonly pagedPartners = computed(() => {
    const page = Math.min(this.pageIndex(), this.totalPages() - 1);
    return this.filteredPartners().slice(page * this.pageSize, page * this.pageSize + this.pageSize);
  });

  readonly isEmptyRecord = computed(() => this.partners().length === 0);
  readonly teamCount = computed(() => this.partners().length);
  readonly activatedCount = computed(() => this.partners().filter((p) => {
    const s = this.info(p._id);
    return !!s && !!s.ipoDone && !!s.qsgDone && !!s.smoDone;
  }).length);
  readonly needsSupportCount = computed(() => Math.max(0, this.teamCount() - this.activatedCount()));
  readonly pendingStampCount = computed(() => {
    let pending = 0;
    for (const p of this.partners()) {
      const s = this.info(p._id);
      if (!s) continue;
      if (!s.ipoDone) pending += 1;
      if (!s.qsgDone) pending += 1;
      if (!s.smoDone) pending += 1;
    }
    return pending;
  });

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  reload(): void {
    this.partners.set([]);
    this.load();
  }

  applyFilter(value: string): void {
    this.filterText.set(value);
    this.pageIndex.set(0);
  }

  clearFilter(): void {
    this.filterText.set('');
    this.pageIndex.set(0);
  }

  setPage(index: number): void {
    this.pageIndex.set(Math.max(0, Math.min(index, this.totalPages() - 1)));
  }

  prevPage(): void { this.setPage(this.pageIndex() - 1); }
  nextPage(): void { this.setPage(this.pageIndex() + 1); }

  presenceStatus(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[String(id)] ?? null);
  }

  info(id: string): PartnerActivationInfo | null {
    return this.supportMap()[String(id)] ?? null;
  }

  support(id: string): void {
    void this.router.navigate(['/dashboard/mentorship/partners/my-partners/detail', id]);
  }

  chat(partner: PartnerInterface): void {
    const id = String(partner._id ?? '');
    if (!id) return;
    const name = `${partner.name ?? ''} ${partner.surname ?? ''}`.trim() || partner.username || 'Partner';
    void this.router.navigate(['/dashboard/messages'], { queryParams: { chat: id, chatName: name } });
  }

  displayName(partner: PartnerInterface): string {
    return `${partner.name ?? ''} ${partner.surname ?? ''}`.trim() || partner.username || 'Partner';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partner: PartnerInterface) => {
          if (!partner) return;
          this.partner.set(partner);
          this.fetchMyPartners(partner._id);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(userError(err) || 'Your session could not be loaded — try signing in again.');
        },
      });
  }

  private fetchMyPartners(partnerId: string): void {
    this.myPartnersService.getPartnersOf(partnerId, { maskContacts: true })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: { data?: PartnerInterface[] }) => {
          const rows = res?.data ?? [];
          this.partners.set(rows);
          this.loading.set(false);
          this.refreshPresence(rows);
        },
        error: (err: unknown) => {
          const status = (err as { status?: unknown })?.status;
          const text = userError(err) || '';
          if (status === 404 && /no partners found/i.test(text)) {
            this.partners.set([]);
            this.loading.set(false);
            return;
          }
          this.loading.set(false);
          this.error.set(text || 'Partners could not be loaded — check your connection and retry.');
        },
      });
    this.leads.activationBoard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const map: Record<string, PartnerActivationInfo> = {};
        for (const item of res.data?.items ?? []) {
          map[String(item.partnerId)] = item;
        }
        this.supportMap.set(map);
      },
      error: () => { /* activation snapshot is optional */ },
    });
  }

  private refreshPresence(rows: PartnerInterface[]): void {
    const ids = rows.map((p) => p._id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    this.presence.lookup(ids).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (map) => this.presenceMap.update((current) => ({ ...current, ...map })),
    });
  }
}
