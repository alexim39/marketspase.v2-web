
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { catchError, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { MyPartnersService } from '../my-partners.service';
import { MyPartnersContactsComponent } from './contacts.component';
import { ContactListQuery, ContactListStats, ContactsService, ProspectContact } from './contacts.service';
import {
  daysSince, fullNameOf, isArchivedLabel, isConvertedLabel, isHotLabel,
  needsAttention, statusLabelOf,
} from './contacts.service';
import { ApiError, userError } from '../../../../../core/http/api-error';

/**
 * @title Downline contact list — coaching view of one partner's prospects.
 *
 * Owns loading: route :id -> downline partner (fail-soft, retryable) and the
 * server-paged contact query (filter/sort/page run in Mongo, stats ride along).
 * Owns the PII gate (same rule as the support dossier): phone/email only for
 * self / admin, and for the direct upline only when the prospect consented.
 * The list component stays presentational.
 */
@Component({
  selector: 'async-manage-contacts-container',
  imports: [MyPartnersContactsComponent, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  providers: [ContactsService, MyPartnersService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <async-page-skeleton layout="table" [rows]="5" label="contact list" [showHeader]="false" />
    }

    @if (error(); as err) {
      <section class="breadcrumb-wrapper">
        <div class="breadcrumb">
          <a routerLink="/dashboard">Dashboard</a> &gt;
          <a routerLink="/dashboard/mentorship/partners/my-partners">My Partners</a> &gt;
          <span>Downline prospects</span>
        </div>
      </section>
      <section class="dp-card container-error" role="alert">
        <mat-icon>error_outline</mat-icon>
        <div>
          <strong>Couldn't load these prospects.</strong>
          <p class="dp-muted">{{ err }}</p>
        </div>
        <span class="spacer"></span>
        <button mat-stroked-button (click)="reload()">Retry</button>
        <button mat-button (click)="backToPartners()">Back to My partners</button>
      </section>
    }
    @if (!loading() && contactsReady()) {
      @if (listError(); as listErr) {
        <section class="dp-card container-error" role="alert">
          <mat-icon>error_outline</mat-icon>
          <div>
            <strong>Couldn’t refresh this view.</strong>
            <p class="dp-muted">{{ listErr }}</p>
          </div>
          <span class="spacer"></span>
          <button mat-stroked-button (click)="retryPage()">Retry</button>
        </section>
      }
      <async-my-partners-contacts
        [partner]="me()"
        [myPartner]="myPartner()"
        [items]="items()"
        [total]="total()"
        [serverStats]="serverStats()"
        [loadingList]="loadingList()"
        [canViewContact]="canViewContact()"
        (queryChange)="onQuery($event)"
        (refreshRequest)="refreshData()" />
    }
  `,
  styles: [`
    .container-error { margin: 1em 0; padding: 1em; display: flex; gap: 0.8em; align-items: center; flex-wrap: wrap; }
    .container-error .spacer { flex: 1; }
    .container-error p { margin: 0.25em 0 0; }
  `],
})
export class MyPartnersContactsContainerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactsApi = inject(ContactsService);
  private readonly partnersApi = inject(MyPartnersService);
  private readonly partnerService = inject(PartnerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly myPartner = signal<PartnerInterface | null>(null);
  readonly me = signal<PartnerInterface | null>(null);
  private readonly ownerId = signal<string>('');

  /** Server page state — set by the list component's query emissions. */
  readonly items = signal<ProspectContact[]>([]);
  readonly total = signal(0);
  readonly serverStats = signal<ContactListStats | null>(null);
  readonly loadingList = signal(false);
  readonly listError = signal<string | null>(null);
  private lastQuery: ContactListQuery | null = null;

  readonly contactsReady = computed(() => this.ownerId() !== '' || this.myPartner() !== null);

  /** Same fail-closed rule as MyPartnerSupportComponent.canViewContact(). */
  readonly canViewContact = computed(() => {
    const me = this.me();
    const mine = this.myPartner();
    if (!me?._id || !mine?._id) return false;
    if (String(me._id) === String(mine._id)) return true;
    if (String((me as { role?: unknown }).role ?? '').toLowerCase() === 'admin') return true;
    const raw = (mine as unknown as { partnerOf?: unknown })?.partnerOf;
    const upline = raw != null && typeof raw === 'object'
      ? String((raw as { _id?: unknown })._id ?? '')
      : String(raw ?? '');
    return !!upline && upline === String(me._id);
  });

  ngOnInit(): void {
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (p) => this.me.set(p as PartnerInterface) });

    this.route.paramMap
      .pipe(
        // Filter URL sync (replaceUrl) re-emits paramMap with the same id —
        // ignore it so typing in search doesn't refetch the owner + flash loading.
        map((params) => String(params.get('id') ?? '').trim()),
        distinctUntilChanged(),
        switchMap((id) => {
          this.ownerId.set(id);
          if (!id) {
            this.loading.set(false);
            this.error.set('Missing partner id.');
            return of(null);
          }
          this.loading.set(true);
          this.error.set(null);
          return this.partnersApi.getPartnerById(id).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (owner) => {
          if (owner === null && this.ownerId()) return; // missing-id path already handled
          this.myPartner.set((owner as { data?: PartnerInterface } | null)?.data ?? null);
          if (!owner) this.error.set('Member profile unavailable — list may still load below.');
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  /** The list component emits its full query (filters + page); Mongo does the work. */
  onQuery(query: ContactListQuery): void {
    const id = this.ownerId();
    if (!id) return;
    // Legacy API (no ?paging support): derive the page locally from a cached
    // full fetch instead of refetching + rendering everything per keystroke.
    if (this.legacyCache && this.legacyOwner === id) {
      this.lastQuery = { ...query };
      this.applyLegacyPage(query);
      return;
    }
    this.fetchPage(id, { ...query, stats: '1' });
  }

  /** Bulk moves change server truth — drop the legacy cache and refetch. */
  refreshData(): void {
    const id = this.ownerId();
    if (!id || !this.lastQuery) return;
    this.legacyCache = null;
    this.fetchPage(id, { ...this.lastQuery, stats: '1' });
  }

  private fetchPage(id: string, query: ContactListQuery): void {
    this.lastQuery = { ...query };
    this.loadingList.set(true);
    this.listError.set(null);
    this.contactsApi.getContactsPage(id, this.lastQuery)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (page.meta) {
            this.legacyCache = null;
            this.items.set(page.data ?? []);
            this.total.set(page.meta.total ?? (page.data ?? []).length);
            if (page.meta.stats) this.serverStats.set(page.meta.stats);
          } else {
            // Server ignored paging — old build. Cache + derive locally.
            this.legacyCache = [...(page.data ?? [])];
            this.legacyOwner = id;
            this.applyLegacyPage(this.lastQuery ?? {});
          }
          this.loadingList.set(false);
        },
        error: (err: ApiError) => {
          this.listError.set(userError(err));
          this.loadingList.set(false);
        },
      });
  }

  /** Full-list cache for pre-paging API builds (transitional — see onQuery). */
  private legacyCache: ProspectContact[] | null = null;
  private legacyOwner = '';

  private applyLegacyPage(query: ContactListQuery): void {
    const all = this.legacyCache ?? [];
    const now = Date.now();
    const stats: ContactListStats = { total: all.length, attention: 0, unworked: 0, hot: 0, converted: 0, archived: 0 };
    for (const c of all) {
      const label = statusLabelOf(c).toLowerCase();
      if (needsAttention(c, now)) stats.attention += 1;
      if (label === 'new prospect') stats.unworked += 1;
      if (isHotLabel(label)) stats.hot += 1;
      if (isConvertedLabel(label)) stats.converted += 1;
      if (isArchivedLabel(label)) stats.archived += 1;
    }
    const q = (query.q ?? '').trim().toLowerCase();
    const st = (query.status ?? '').trim().toLowerCase();
    const att = (query.attention ?? 'all').toLowerCase();
    const ch = (query.channel ?? 'all').toLowerCase();
    const filtered = all.filter((c) => {
      if (st && statusLabelOf(c).toLowerCase() !== st) return false;
      if (ch !== 'all') {
        const link = String(c.prospectSource ?? '').toLowerCase().includes('link');
        if (ch === 'link' && !link) return false;
        if (ch === 'other' && link) return false;
      }
      const label = statusLabelOf(c).toLowerCase();
      if (att === 'attention' && !needsAttention(c, now)) return false;
      if (att === 'unworked' && label !== 'new prospect') return false;
      if (att === 'hot' && !isHotLabel(label)) return false;
      if (att === 'converted' && !isConvertedLabel(label)) return false;
      if (att === 'archived' && !isArchivedLabel(label)) return false;
      if (q) {
        const hay = `${c.prospectName ?? ''} ${c.prospectSurname ?? ''} ${c.prospectPhone ?? ''} ${c.prospectEmail ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const mode = (query.sort ?? 'attention').toLowerCase();
    const byNew = (a: ProspectContact, b: ProspectContact) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    const sorted = [...filtered];
    if (mode === 'oldest') sorted.sort((a, b) => -byNew(a, b));
    else if (mode === 'name') sorted.sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
    else if (mode === 'newest') sorted.sort(byNew);
    else sorted.sort((a, b) => daysSince(b.updatedAt ?? b.createdAt, now) - daysSince(a.updatedAt ?? a.createdAt, now));
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const page = Math.max(1, query.page ?? 1);
    this.serverStats.set(stats);
    this.total.set(filtered.length);
    this.items.set(sorted.slice((page - 1) * limit, (page - 1) * limit + limit));
  }

  retryPage(): void {
    if (!this.lastQuery) return;
    if (this.legacyCache) this.applyLegacyPage(this.lastQuery);
    else this.refreshData();
  }

  reload(): void {
    const id = this.ownerId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.partnersApi.getPartnerById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (owner) => {
          this.myPartner.set((owner as { data?: PartnerInterface } | null)?.data ?? null);
          this.loading.set(false);
          this.retryPage();
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  backToPartners(): void {
    this.router.navigateByUrl('dashboard/mentorship/partners/my-partners');
  }
}
