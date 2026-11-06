import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject,
  input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { ExportContactAndEmailService } from '../../../../../_common/services/exportContactAndEmail.service';
import { AvatarComponent } from '../../../../../_common/avatar.component';
import { userError } from '../../../../../core/http/api-error';
import {
  CONTACT_STATUSES, ContactListQuery, ContactListStats, ProspectContact, ContactsService,
  contactId, daysSince, fullNameOf, needsAttention, statusLabelOf, statusToneOf,
} from './contacts.service';

export type AttentionFilter = 'all' | 'attention' | 'unworked' | 'hot' | 'converted' | 'archived';
export type SortMode = 'attention' | 'newest' | 'oldest' | 'stuck' | 'name';

const EMPTY_STATS: ContactListStats = { total: 0, attention: 0, unworked: 0, hot: 0, converted: 0, archived: 0 };

/**
 * @title Downline contact list — coach what is stuck, not just what exists.
 *
 * Presentational: the container owns fetch + PII gate and feeds one server
 * page ({ items, total, stats }) per query emission. Filtering, sorting and
 * paging run in Mongo; this component owns selection, bulk actions and CSV.
 * OnPush + signals.
 */
@Component({
  selector: 'async-my-partners-contacts',
  templateUrl: 'contacts.component.html',
  styleUrls: ['contacts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, MatButtonModule, MatCheckboxModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule,
    MatProgressBarModule, MatSelectModule, MatSnackBarModule, MatTableModule,
    MatTooltipModule, PageSkeletonComponent, RouterModule,
  ],
})
export class MyPartnersContactsComponent {
  readonly partner = input<PartnerInterface | null>(null);
  readonly myPartner = input<PartnerInterface | null>(null);
  readonly items = input<ProspectContact[]>([]);
  readonly total = input(0);
  readonly serverStats = input<ContactListStats | null>(null);
  readonly loadingList = input(false);
  readonly canViewContact = input(true);
  readonly queryChange = output<ContactListQuery>();
  /** Bulk moves change server truth — ask the container to refetch. */
  readonly refreshRequest = output<void>();

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly contactsApi = inject(ContactsService);
  private readonly exportApi = inject(ExportContactAndEmailService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = CONTACT_STATUSES;
  // Filter state seeds from the URL so shared links reproduce the view.
  readonly query = signal(String(this.route.snapshot.queryParamMap.get('q') ?? ''));
  readonly status = signal(String(this.route.snapshot.queryParamMap.get('status') ?? ''));
  readonly attention = signal<AttentionFilter>(this.readAttentionParam());
  readonly channel = signal<'all' | 'link' | 'other'>(this.readChannelParam());
  readonly sort = signal<SortMode>(this.readSortParam());
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly selection = signal<Set<string>>(new Set());
  readonly bulkStatus = signal('');
  readonly busy = signal(false);
  readonly exporting = signal(false);
  /** True once the first server page lands — gates empty states. */
  readonly responded = computed(() => this.serverStats() !== null);
  /** id -> last-seen contact, so cross-page selection can still export/call.
   * Plain Map (NOT a signal): the mirror effect below must never write a
   * signal it reads — a set() with a fresh Map reference re-triggers the
   * effect forever and freezes the page. */
  private readonly contactCache = new Map<string, ProspectContact>();

  private lastFilterSig = '';
  private lastEmitted = '';
  private emitLog: number[] = [];
  private prevOwner = '\0';
  private emitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Mirror page items into the selection cache. Writes only the plain
    // Map — never a signal this effect reads, so no reactive loop.
    effect(() => {
      for (const c of this.items()) {
        const id = contactId(c);
        if (id) this.contactCache.set(id, c);
      }
    });

    // Any filter/sort/page change re-queries (q keystrokes debounced).
    effect(() => {
      const owner = String(this.myPartner()?._id ?? '');
      const q = this.query();
      const st = this.status();
      const att = this.attention();
      const ch = this.channel();
      const s = this.sort();
      const pi = this.pageIndex();
      const ps = this.pageSize();
      if (owner !== this.prevOwner) {
        this.prevOwner = owner;
        this.selection.set(new Set());
        this.contactCache.clear();
      }
      const filterSig = JSON.stringify([owner, q, st, att, ch, s, ps]);
      if (filterSig !== this.lastFilterSig) {
        this.lastFilterSig = filterSig;
        if (pi !== 0) {
          this.pageIndex.set(0);
          return;
        }
      }
      const payload = this.buildQuery();
      const key = JSON.stringify(payload);
      if (key === this.lastEmitted || !owner) return;
      const qOnly = this.isQueryOnlyChange(payload);
      if (this.emitTimer) clearTimeout(this.emitTimer);
      if (qOnly) {
        this.emitTimer = setTimeout(() => this.doEmit(payload, key), 350);
      } else {
        this.doEmit(payload, key);
      }
    }, { allowSignalWrites: true });
  }

  private readAttentionParam(): AttentionFilter {
    const a = String(this.route.snapshot.queryParamMap.get('filter') ?? '').toLowerCase();
    return (['attention', 'unworked', 'hot', 'converted', 'archived'] as const).includes(a as never)
      ? (a as AttentionFilter) : 'all';
  }

  private readChannelParam(): 'all' | 'link' | 'other' {
    const c = String(this.route.snapshot.queryParamMap.get('channel') ?? '').toLowerCase();
    return c === 'link' || c === 'other' ? c : 'all';
  }

  private readSortParam(): SortMode {
    const s = String(this.route.snapshot.queryParamMap.get('sort') ?? '').toLowerCase();
    return (['newest', 'oldest', 'stuck', 'name'] as const).includes(s as never) ? (s as SortMode) : 'attention';
  }

  /* ---------------- query ---------------- */

  private buildQuery(): ContactListQuery {
    return {
      ...(this.query().trim() ? { q: this.query().trim() } : {}),
      ...(this.status() ? { status: this.status() } : {}),
      ...(this.attention() !== 'all' ? { attention: this.attention() } : {}),
      ...(this.channel() !== 'all' ? { channel: this.channel() } : {}),
      sort: this.sort(),
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
    };
  }

  private isQueryOnlyChange(payload: ContactListQuery): boolean {
    if (!this.lastEmitted) return true;
    try {
      const prev = JSON.parse(this.lastEmitted) as ContactListQuery;
      const { q: _a, ...restPrev } = prev;
      const { q: _b, ...restNext } = payload;
      return JSON.stringify(restPrev) === JSON.stringify(restNext);
    } catch {
      return false;
    }
  }

  private doEmit(payload: ContactListQuery, key: string): void {
    // Circuit breaker: healthy operation emits at most ~2/s (debounced
    // typing). A storm here means a feedback loop — freeze the refresh,
    // never the app: surface it and let the next user action resume.
    const now = Date.now();
    this.emitLog = this.emitLog.filter((t) => now - t < 1000);
    this.emitLog.push(now);
    if (this.emitLog.length > 10) {
      console.error('[contacts] query emission storm detected, pausing auto-refresh', payload);
      this.snack.open('List auto-refresh paused (loop detected) — change a filter to resume.', 'Close', { duration: 6000 });
      return;
    }
    this.lastEmitted = key;
    this.queryChange.emit(payload);
  }

  /** Re-run the current server query (e.g. after a bulk move). */
  private refresh(): void {
    this.refreshRequest.emit();
  }

  stats(): ContactListStats {
    return this.serverStats() ?? EMPTY_STATS;
  }

  /* ---------------- header ---------------- */

  ownerName(): string {
    const p = this.myPartner();
    if (!p) return 'Partner';
    return `${p.name ?? ''} ${p.surname ?? ''}`.trim() || p.username || 'Partner';
  }

  ownerId(): string {
    return String(this.myPartner()?._id ?? '');
  }

  subtitle(): string {
    const s = this.stats();
    if (!s.total) return 'No contacts yet';
    return `${s.total} contact${s.total === 1 ? '' : 's'} · ${s.attention} need attention · ${s.converted} converted`;
  }

  /* ---------------- row helpers (template) ---------------- */

  rowId = (c: ProspectContact): string => contactId(c);
  rowName = (c: ProspectContact): string => fullNameOf(c);
  rowInitials(c: ProspectContact): string {
    const parts = fullNameOf(c).split(/\s+/).filter(Boolean);
    if (!parts.length || fullNameOf(c) === 'Prospect') return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  rowStatus = (c: ProspectContact): string => statusLabelOf(c);
  rowTone = (c: ProspectContact): string => statusToneOf(statusLabelOf(c));
  rowDays(c: ProspectContact): number { return daysSince(c.updatedAt ?? c.createdAt); }
  rowNeeds = (c: ProspectContact): boolean => needsAttention(c);

  phoneDisplay(c: ProspectContact): string {
    if (!this.canViewContact() || c.phoneHiddenReason === 'not-direct') return 'Hidden';
    if (c.phoneHiddenReason === 'no-consent') return 'No consent';
    return c.prospectPhone || '—';
  }

  emailDisplay(c: ProspectContact): string {
    if (!this.canViewContact() || c.emailHiddenReason === 'not-direct') return 'Hidden';
    if (c.emailHiddenReason === 'no-consent') return 'No consent';
    return c.prospectEmail || '—';
  }

  /* ---------------- filters ---------------- */

  onQuery(value: string): void {
    this.query.set(value);
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.syncUrl();
  }

  setAttention(value: AttentionFilter): void {
    this.attention.set(value);
    this.syncUrl();
  }

  setChannel(value: 'all' | 'link' | 'other'): void {
    this.channel.set(value);
    this.syncUrl();
  }

  setSort(value: SortMode): void {
    this.sort.set(value);
    this.syncUrl();
  }

  clearFilters(): void {
    this.query.set(''); this.status.set(''); this.attention.set('all');
    this.channel.set('all'); this.sort.set('attention');
    this.syncUrl();
  }

  hasActiveFilters(): boolean {
    return !!this.query().trim() || !!this.status() || this.attention() !== 'all' || this.channel() !== 'all';
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.query().trim() || null,
        status: this.status() || null,
        filter: this.attention() === 'all' ? null : this.attention(),
        channel: this.channel() === 'all' ? null : this.channel(),
        sort: this.sort() === 'attention' ? null : this.sort(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }).catch(() => undefined);
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  /* ---------------- selection ---------------- */

  isSelected(c: ProspectContact): boolean {
    return this.selection().has(contactId(c));
  }

  toggleOne(c: ProspectContact): void {
    const next = new Set(this.selection());
    const id = contactId(c);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selection.set(next);
  }

  pageIds(): string[] {
    return this.items().map((c) => contactId(c)).filter(Boolean);
  }

  isAllPageSelected(): boolean {
    const ids = this.pageIds();
    if (!ids.length) return false;
    const sel = this.selection();
    return ids.every((id) => sel.has(id));
  }

  isSomePageSelected(): boolean {
    const sel = this.selection();
    if (!sel.size || this.isAllPageSelected()) return false;
    return this.pageIds().some((id) => sel.has(id));
  }

  togglePage(checked: boolean): void {
    const next = new Set(this.selection());
    for (const id of this.pageIds()) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    this.selection.set(next);
  }

  clearSelection(): void {
    this.selection.set(new Set());
    this.bulkStatus.set('');
  }

  /* ---------------- bulk + export ---------------- */

  applyBulkStatus(): void {
    const ids = [...this.selection()];
    const target = this.bulkStatus().trim();
    if (!ids.length || !target || this.busy()) return;
    this.busy.set(true);
    this.contactsApi.updateManyStatuses(ids, target)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const moved = res.data?.updated ?? ids;
          const skipped = res.data?.skipped ?? [];
          this.clearSelection();
          this.busy.set(false);
          this.snack.open(
            skipped.length
              ? `Moved ${moved.length} contact${moved.length === 1 ? '' : 's'} to ${target} — ${skipped.length} skipped (no access).`
              : `Moved ${moved.length} contact${moved.length === 1 ? '' : 's'} to ${target}.`,
            'Close', { duration: 4000 });
          this.refresh();
        },
        error: (err) => {
          this.busy.set(false);
          this.snack.open(userError(err) || 'Bulk update failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  /** Resolve selected ids to contacts: page cache first, full filtered fetch as fallback. */
  private resolveSelected(action: string, run: (list: ProspectContact[]) => void): void {
    const ids = [...this.selection()];
    if (!ids.length) {
      this.snack.open(`Select at least one contact to ${action}.`, 'Close', { duration: 3500 });
      return;
    }
    if (!this.canViewContact()) {
      this.snack.open('Contact details are visible to their upline only — export disabled.', 'Close', { duration: 4000 });
      return;
    }
    const cache = this.contactCache;
    const hit = ids.map((id) => cache.get(id)).filter((c): c is ProspectContact => !!c);
    if (hit.length === ids.length) {
      run(hit);
      return;
    }
    this.exporting.set(true);
    const { page: _p, limit: _l, ...unpaged } = this.buildQuery();
    this.contactsApi.getContactsPage(this.ownerId(), unpaged)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.exporting.set(false);
          const byId = new Map((page.data ?? []).map((c) => [contactId(c), c] as const));
          for (const [id, c] of byId) this.contactCache.set(id, c);
          run(ids.map((id) => byId.get(id) ?? cache.get(id)).filter((c): c is ProspectContact => !!c));
        },
        error: (err) => {
          this.exporting.set(false);
          this.snack.open(userError(err) || 'Could not load contacts — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  exportSms(): void {
    this.resolveSelected('message', (list) => {
      const phones = list.map((c) => String(c.prospectPhone ?? '').trim()).filter(Boolean);
      if (!phones.length) {
        this.snack.open('Selected contacts have no consented phone numbers.', 'Close', { duration: 3500 });
        return;
      }
      this.exportApi.setData(phones);
      this.router.navigate(['/dashboard/tools/sms/new']).catch(() => undefined);
    });
  }

  exportEmail(): void {
    this.resolveSelected('email', (list) => {
      const emails = list.map((c) => String(c.prospectEmail ?? '').trim().toLowerCase()).filter(Boolean);
      if (!emails.length) {
        this.snack.open('Selected contacts have no consented email addresses.', 'Close', { duration: 3500 });
        return;
      }
      this.exportApi.setData(emails);
      this.router.navigate(['/dashboard/tools/email/new']).catch(() => undefined);
    });
  }

  exportCsv(): void {
    if (!this.canViewContact()) {
      this.snack.open('Contact details are visible to their upline only — export disabled.', 'Close', { duration: 4000 });
      return;
    }
    const proceed = (base: ProspectContact[], label: string): void => {
      if (!base.length) {
        this.snack.open(`Nothing to export (${label}).`, 'Close', { duration: 3500 });
        return;
      }
      const esc = (v: unknown): string => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = [
        'Name,Surname,Phone,Email,Consent,Channel,Status,Last updated',
        ...base.map((c) => [
          esc(c.prospectName), esc(c.prospectSurname), esc(c.prospectPhone),
          esc(c.prospectEmail), esc(c.consentToContact ? 'Yes' : 'No'),
          esc(c.prospectSource), esc(statusLabelOf(c)),
          esc(c.updatedAt ?? c.createdAt ?? ''),
        ].join(',')),
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contact-list-${String(this.myPartner()?.username ?? 'partner').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.snack.open(`Exported ${base.length} contact${base.length === 1 ? '' : 's'} to CSV.`, 'Close', { duration: 3500 });
    };
    const selected = [...this.selection()];
    if (selected.length) {
      this.resolveSelected('export', (list) => proceed(list, 'selection'));
      return;
    }
    if (!this.total()) {
      this.snack.open('Nothing to export with current filters.', 'Close', { duration: 3500 });
      return;
    }
    this.exporting.set(true);
    const { page: _p2, limit: _l2, ...unpagedView } = this.buildQuery();
    this.contactsApi.getContactsPage(this.ownerId(), unpagedView)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.exporting.set(false);
          proceed(page.data ?? [], 'current view');
        },
        error: (err) => {
          this.exporting.set(false);
          this.snack.open(userError(err) || 'Could not load contacts — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  /* ---------------- navigation ---------------- */

  preview(id: string): void {
    if (!id) return;
    this.router.navigate(
      ['/dashboard/mentorship/partners/my-partners/contact-detail', id],
      { queryParams: { from: this.ownerId() || null } },
    ).catch(() => undefined);
  }

  back(): void {
    if (window.history.length > 1) window.history.back();
    else this.viewDossier();
  }

  viewDossier(): void {
    const id = this.ownerId();
    if (id) this.router.navigate(['/dashboard/mentorship/partners/my-partners/detail', id]).catch(() => undefined);
    else this.router.navigateByUrl('dashboard/mentorship/partners/my-partners').catch(() => undefined);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
