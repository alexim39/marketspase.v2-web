import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { DownlineContact, DownlineContactListItem } from '../../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../../core/http/api-error';

type ListFilter = 'all' | 'needs-work' | 'done' | 'overdue';
type SortBy = 'attention' | 'newest' | 'oldest' | 'unworked' | 'name';

const PAGE_SIZE = 8;
const PREVIEW_COUNT = 5;

interface MemberGroup {
  partnerId: string;
  name: string;
  username: string;
  batches: DownlineContactListItem[];
  lists: number;
  contacts: number;
  worked: number;
  unworked: number;
  overdue: boolean;
  lastSubmitted: string | null;
}

/**
 * @title Downline contact lists — the upline workbench, grouped by member.
 *
 * Redesign for scale: lists are grouped under one card per downline member
 * (avatar, @username, lists/contacts/unworked, overdue, last submitted) so
 * an upline with 50+ partners instantly sees WHO each list came from.
 * Member filter + sort (newest/oldest/unworked/name) + status filter + search
 * + member pagination (8/page) + per-batch expand keep huge volumes usable.
 * Every action deep-links to a working page (contacts, pipeline, activation).
 * OnPush + signals, fully typed, fail-soft.
 */
@Component({
  selector: 'async-downline-contact-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Warm-market mentoring</span>
      </div>
    </section>

    <section class="lists-page">
      <div class="page-head">
        <div>
          <h2>Downline warm lists</h2>
          <p class="subtitle">Warm-market mentoring — grouped by downline member. Pick a person, work their newest list first, and book sessions from the pipeline.</p>
        </div>
        <div class="head-actions">
          <a mat-button routerLink="../activation">Activation board</a>
          <button mat-button (click)="reload()" [disabled]="loading()">Refresh</button>
        </div>
      </div>

      <div class="dp-card info-note" role="note">
        <mat-icon>info</mat-icon>
        <p>
          <strong>These contacts belong to the downline member.</strong> You are coaching them; any sale or conversion
          stays with them and does not create growth commission for you. Growth commissions follow campaign placement.
        </p>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (!loading() && !error() && items().length > 0) {
        <div class="chip-row" role="status">
          <mat-chip highlighted>{{ memberCount() }} member{{ memberCount() === 1 ? '' : 's' }}</mat-chip>
          <mat-chip highlighted>{{ items().length }} list{{ items().length === 1 ? '' : 's' }}</mat-chip>
          <mat-chip highlighted>{{ totalContacts() }} contacts</mat-chip>
          <mat-chip highlighted>{{ unworkedCount() }} unworked</mat-chip>
          @if (overdueCount() > 0) {
            <mat-chip color="warn" highlighted>{{ overdueCount() }} overdue 48h</mat-chip>
          }
        </div>

        <div class="toolbar">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
            <mat-label>Search member, username or consented phone</mat-label>
            <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value); page.set(0)" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Member</mat-label>
            <mat-select [value]="memberFilter()" (selectionChange)="memberFilter.set($event.value); page.set(0)">
              <mat-option value="all">All members</mat-option>
              @for (m of memberOptions(); track m.partnerId) {
                <mat-option [value]="m.partnerId">{{ m.name }} (@{{ m.username }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Sort members</mat-label>
            <mat-select [value]="sortBy()" (selectionChange)="sortBy.set($event.value); page.set(0)">
              <mat-option value="attention">Needs attention first</mat-option>
              <mat-option value="newest">Newest list first</mat-option>
              <mat-option value="oldest">Oldest pending first</mat-option>
              <mat-option value="unworked">Most unworked first</mat-option>
              <mat-option value="name">Member name A–Z</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="toolbar">
          <div class="filter-row" role="radiogroup" aria-label="List filter">
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all'); page.set(0)">All</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'needs-work'" [attr.aria-pressed]="filter() === 'needs-work'" (click)="filter.set('needs-work'); page.set(0)">Needs work</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'overdue'" [attr.aria-pressed]="filter() === 'overdue'" (click)="filter.set('overdue'); page.set(0)">Overdue</button>
            <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'done'" [attr.aria-pressed]="filter() === 'done'" (click)="filter.set('done'); page.set(0)">Fully worked</button>
          </div>
        </div>

        <div class="expand-row">
          <span class="muted">Showing {{ pagedGroups().length }} of {{ groups().length }} members</span>
          <span class="spacer"></span>
          <button mat-button (click)="expandAllMembers()">Expand members</button>
          <button mat-button (click)="collapseAllMembers()">Collapse</button>
        </div>
      }

      @if (pagedGroups().length > 0) {
        <ul class="member-list">
          @for (g of pagedGroups(); track g.partnerId) {
            <li class="dp-card member">
              <button type="button" class="member-head" (click)="toggleMember(g.partnerId)" [attr.aria-expanded]="isMemberExpanded(g.partnerId)">
                <span class="avatar">{{ initials(g) }}</span>
                <span class="member-id">
                  <strong>{{ g.name }}</strong>
                  <span class="muted">@{{ g.username }} · {{ g.lists }} list{{ g.lists === 1 ? '' : 's' }} · {{ g.unworked }} unworked</span>
                </span>
                <span class="member-meta">
                  @if (g.overdue) {
                    <span class="dp-status dp-status--bad">Overdue</span>
                  }
                  @if (g.lastSubmitted) {
                    <span class="muted">{{ g.lastSubmitted | date:'mediumDate' }}</span>
                  }
                </span>
                <mat-icon>{{ isMemberExpanded(g.partnerId) ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>

              @if (isMemberExpanded(g.partnerId)) {
                <div class="member-actions">
                  <a mat-button [routerLink]="['/dashboard/mentorship/partners/my-partners/contacts', g.partnerId]">View contacts</a>
                  <a mat-button routerLink="/dashboard/mentorship/team/activation">Activation</a>
                </div>
                <ul class="batch-list">
                  @for (b of g.batches; track b.partnerId + b.batch) {
                    <li class="batch">
                      <div class="batch-head">
                        <div>
                          <strong>Batch {{ b.batch }}</strong>
                          <span class="muted">submitted {{ b.submittedAt | date:'mediumDate' }}</span>
                        </div>
                        <span class="count-pill">{{ b.worked }} of {{ b.total }} worked</span>
                      </div>
                      <mat-progress-bar mode="determinate" [value]="b.total ? (b.worked / b.total) * 100 : 0" aria-label="Progress" />
                      <div class="entry-tags">
                        @if (b.sla?.overdue) {
                          <mat-chip color="warn" highlighted>Overdue 48h — first touch needed</mat-chip>
                        } @else if (b.sla && b.worked === 0 && (b.sla.hoursLeft ?? -1) >= 0) {
                          <mat-chip highlighted>First touch due in {{ b.sla.hoursLeft }}h</mat-chip>
                        }
                        @for (stage of stageKeys(b); track stage) {
                          <mat-chip highlighted>{{ stage }} ({{ b.stageCounts[stage] }})</mat-chip>
                        }
                      </div>
                      <ul class="contact-list">
                        @for (c of visibleContacts(b); track c.id) {
                          <li class="contact" [class.contact--worked]="c.stage !== 'New'">
                            <div>
                              <strong>{{ c.prospectName }} {{ c.prospectSurname }}</strong>
                              @if (c.prospectPhone) {
                                <a class="phone" [href]="'tel:' + c.prospectPhone">{{ c.prospectPhone }}</a>
                              } @else {
                                <span class="phone-hidden" [class.phone-hidden--consent]="c.phoneHiddenReason === 'no-consent'">{{ phoneHiddenLabel(c) }}</span>
                              }
                              <div class="entry-tags">
                                <mat-chip highlighted>{{ c.relationship }}</mat-chip>
                                @if (c.priority === 'high') {
                                  <mat-chip color="warn" highlighted>High priority</mat-chip>
                                }
                                @if (c.consentToContact) {
                                  <mat-chip color="primary" highlighted>Consented</mat-chip>
                                } @else {
                                  <mat-chip color="warn" highlighted>No consent</mat-chip>
                                }
                                @if (c.phoneHiddenReason === 'not-direct') {
                                  <mat-chip highlighted>Direct upline only</mat-chip>
                                }
                                <mat-chip highlighted>{{ c.stage }}</mat-chip>
                              </div>
                              @if (c.bestTimeToCall) {
                                <p class="muted">Best time: {{ c.bestTimeToCall }}</p>
                              }
                            </div>
                            <span class="spacer"></span>
                            @if (c.prospectPhone) {
                              <a mat-button [href]="'tel:' + c.prospectPhone" aria-label="Call {{ c.prospectName }}">
                                <mat-icon>call</mat-icon> Call
                              </a>
                            }
                            <a mat-button [routerLink]="['/dashboard/prospects/detail', c.id]" aria-label="Open {{ c.prospectName }} in pipeline">Open</a>
                          </li>
                        }
                      </ul>
                      @if (b.total > b.contacts.length) {
                        <p class="batch-note">
                          Showing {{ b.contacts.length }} of {{ b.total }} contacts in this preview.
                          Open “View contacts” for the full, paged list.
                        </p>
                      }
                      @if (b.contacts.length > previewCount) {
                        <button mat-button (click)="toggle(batchKey(b))">
                          {{ isExpanded(batchKey(b)) ? 'Show less' : 'Show ' + b.contacts.length + ' loaded' }}
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <div class="pager">
            <button mat-button (click)="prev()" [disabled]="page() === 0">Previous</button>
            <span class="muted" role="status">Page {{ page() + 1 }} of {{ totalPages() }}</span>
            <button mat-button (click)="next()" [disabled]="page() + 1 >= totalPages()">Next</button>
          </div>
        }
      } @else if (!loading() && !error()) {
        @if (items().length === 0) {
          <div class="empty-card">
            <mat-icon>contact_phone</mat-icon>
            <p><strong>No submitted lists yet.</strong></p>
            <p class="muted">When a downline member submits their warm contact list (any number, from Tools → Contacts → New), it lands here grouped by member — newest first. If a member just submitted and you still see this, confirm they are in your downline (Network tree) and pull to refresh.</p>
            <a mat-button routerLink="/dashboard/mentorship/partners/my-partners">Check my downline</a>
          </div>
        } @else {
          <p class="empty">No lists match — <button mat-button (click)="clearSearch()">clear search</button></p>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .lists-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .head-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .head-actions button, .head-actions a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .info-note { display: flex; gap: 0.65em; align-items: flex-start; padding: 0.85em 1em; }
    .info-note mat-icon { color: var(--ms-primary-strong); flex: none; }
    .info-note p { margin: 0; line-height: 1.5; color: var(--ms-text-muted); }
    .chip-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; }
    .toolbar mat-form-field { flex: 1; min-width: 200px; }
    .toolbar .search-field { flex: 2 1 240px; }
    .filter-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .filter-btn { border: 1px solid var(--ms-line); background: transparent; border-radius: 999px; padding: 0.5em 1em; min-height: 44px; cursor: pointer; color: inherit; font: inherit; font-size: 0.85rem; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
    .expand-row { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .expand-row button { min-height: 44px; }
    .member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; }
    .member { padding: 0; overflow: hidden; }
    .member-head { width: 100%; display: flex; align-items: center; gap: 0.75em; padding: 0.9em 1em; background: transparent; border: none; cursor: pointer; color: inherit; font: inherit; text-align: left; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--ms-primary), #6b4e12); flex: none; }
    .member-id { display: flex; flex-direction: column; gap: 0.1em; min-width: 0; flex: 1; }
    .member-id strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .member-meta { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .member-actions { display: flex; gap: 0.4em; flex-wrap: wrap; padding: 0 1em 0.5em; }
    .member-actions a { min-height: 44px; }
    .batch-list { list-style: none; margin: 0; padding: 0 1em 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .batch { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.55em; }
    .batch-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .count-pill { font-size: 0.85em; font-weight: 800; border-radius: 999px; padding: 0.3em 0.9em; background: var(--ms-surface); border: 1px solid var(--ms-line); color: var(--ms-text-muted); white-space: nowrap; }
    .entry-tags { display: flex; gap: 0.3em; flex-wrap: wrap; margin-top: 0.3em; }
    .contact-list { list-style: none; margin: 0.4em 0 0; padding: 0; display: flex; flex-direction: column; }
    .contact { display: flex; align-items: center; gap: 0.75em; padding: 0.6em 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .contact--worked { opacity: 0.7; }
    .contact p { margin: 0.2em 0 0; }
    .phone { color: var(--ms-primary-strong); font-weight: 600; text-decoration: none; margin-left: 0.5em; }
    .phone-hidden { color: var(--ms-warning); font-size: 0.9em; font-weight: 600; margin-left: 0.5em; }
    .phone-hidden--consent { color: var(--ms-error); }
    .batch-note { margin: 0.3em 0 0; color: var(--ms-text-muted); font-size: 0.8em; line-height: 1.45; }
    .contact a[mat-button], .batch button[mat-button], .pager button { min-height: 44px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 1em; }
    .spacer { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.4em; text-align: center; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em; color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
    .empty-card p { margin: 0; max-width: 38em; }
    .empty-card a { min-height: 44px; }
    @media only screen and (max-width: 600px) {
      .member-head { align-items: flex-start; }
      .member-meta { width: 100%; }
    }
  `],
})
export class DownlineContactListsComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<DownlineContactListItem[]>([]);
  protected readonly query = signal('');
  protected readonly filter = signal<ListFilter>('all');
  protected readonly memberFilter = signal('all');
  protected readonly sortBy = signal<SortBy>('newest');
  protected readonly page = signal(0);
  protected readonly expanded = signal<Record<string, boolean>>({});
  protected readonly expandedMembers = signal<Record<string, boolean>>({});
  protected readonly previewCount = PREVIEW_COUNT;

  protected readonly memberOptions = computed(() => {
    const seen = new Map<string, { partnerId: string; name: string; username: string }>();
    for (const b of this.items()) {
      if (!seen.has(b.partnerId)) {
        seen.set(b.partnerId, {
          partnerId: b.partnerId,
          name: b.member?.name ?? 'Team member',
          username: b.member?.username ?? '—',
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filteredBatches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    const m = this.memberFilter();
    return this.items().filter((b) => {
      if (m !== 'all' && b.partnerId !== m) return false;
      if (f === 'needs-work' && (b.total - b.worked) <= 0) return false;
      if (f === 'done' && (b.total - b.worked) > 0) return false;
      if (f === 'overdue' && b.sla?.overdue !== true) return false;
      if (!q) return true;
      const hay = `${b.member?.name ?? ''} ${b.member?.username ?? ''} ${(b.contacts ?? []).map((c) => `${c.prospectName} ${c.prospectSurname} ${c.prospectPhone ?? ''}`).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  });

  protected readonly groups = computed<MemberGroup[]>(() => {
    const byMember = new Map<string, MemberGroup>();
    for (const b of this.filteredBatches()) {
      let g = byMember.get(b.partnerId);
      if (!g) {
        g = {
          partnerId: b.partnerId,
          name: b.member?.name ?? 'Team member',
          username: b.member?.username ?? '—',
          batches: [],
          lists: 0,
          contacts: 0,
          worked: 0,
          unworked: 0,
          overdue: false,
          lastSubmitted: null,
        };
        byMember.set(b.partnerId, g);
      }
      g.batches.push(b);
    }
    const out = [...byMember.values()].map((g) => {
      const batches = [...g.batches].sort((a, b) =>
        new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());
      const contacts = batches.reduce((n, b) => n + (b.contacts?.length ?? 0), 0);
      const worked = batches.reduce((n, b) => n + (b.worked ?? 0), 0);
      const total = batches.reduce((n, b) => n + (b.total ?? 0), 0);
      const overdue = batches.some((b) => b.sla?.overdue === true);
      const last = batches.length ? (batches[0].submittedAt ?? null) : null;
      return { ...g, batches, lists: batches.length, contacts, worked, unworked: Math.max(0, total - worked), overdue, lastSubmitted: last };
    });
    const sort = this.sortBy();
    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'unworked') return b.unworked - a.unworked;
      // Attention first: overdue members top, then most unworked, then newest —
      // the upline workbench answers "who needs me next" without filtering.
      if (sort === 'attention') {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (b.unworked !== a.unworked) return b.unworked - a.unworked;
        const at = (v: string | null) => (v ? new Date(v).getTime() : 0);
        return at(b.lastSubmitted) - at(a.lastSubmitted);
      }
      if (sort === 'oldest') {
        const at = (g: MemberGroup) => {
          const pending = g.batches.filter((x) => (x.total - x.worked) > 0).map((x) => new Date(x.submittedAt ?? 0).getTime());
          return pending.length ? Math.min(...pending) : Number.MAX_SAFE_INTEGER;
        };
        return at(a) - at(b);
      }
      const at = (v: string | null) => (v ? new Date(v).getTime() : 0);
      return at(b.lastSubmitted) - at(a.lastSubmitted);
    });
    return out;
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.groups().length / PAGE_SIZE)));

  protected readonly pagedGroups = computed(() => {
    const p = Math.min(this.page(), this.totalPages() - 1);
    return this.groups().slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  });

  protected readonly memberCount = computed(() => new Set(this.items().map((b) => b.partnerId)).size);
  protected readonly totalContacts = computed(() => this.items().reduce((n, b) => n + (b.contacts?.length ?? 0), 0));
  protected readonly unworkedCount = computed(() => this.items().reduce((n, b) => n + Math.max(0, (b.total ?? 0) - (b.worked ?? 0)), 0));
  protected readonly overdueCount = computed(() => this.items().filter((b) => b.sla?.overdue === true).length);

  ngOnInit(): void {
    const member = this.route.snapshot.queryParamMap.get('member')?.trim() ?? '';
    if (member) this.query.set(member);
    this.reload();
  }

  protected initials(g: MemberGroup): string {
    const parts = String(g.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length || g.name === 'Team member') return (g.username?.[0] ?? '?').toUpperCase();
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  protected stageKeys(b: DownlineContactListItem): string[] {
    return Object.keys(b.stageCounts ?? {}).sort();
  }

  protected phoneHiddenLabel(c: DownlineContact): string {
    switch (c.phoneHiddenReason) {
      case 'no-phone': return 'No phone on file';
      case 'not-direct': return 'Phone hidden — direct upline only';
      case 'no-consent': return 'No consent — do not call';
      default: return 'Phone unavailable';
    }
  }

  protected batchKey(b: DownlineContactListItem): string {
    return `${b.partnerId}::${b.batch}`;
  }

  protected isExpanded(key: string): boolean {
    return this.expanded()[key] === true;
  }

  protected toggle(key: string): void {
    this.expanded.update((m) => ({ ...m, [key]: !m[key] }));
  }

  protected isMemberExpanded(partnerId: string): boolean {
    const map = this.expandedMembers();
    if (!(partnerId in map)) return true;
    return map[partnerId] === true;
  }

  protected toggleMember(partnerId: string): void {
    this.expandedMembers.update((m) => {
      const current = partnerId in m ? m[partnerId] : true;
      return { ...m, [partnerId]: !current };
    });
  }

  protected expandAllMembers(): void {
    const all: Record<string, boolean> = {};
    for (const g of this.pagedGroups()) all[g.partnerId] = true;
    this.expandedMembers.update((m) => ({ ...m, ...all }));
  }

  protected collapseAllMembers(): void {
    const all: Record<string, boolean> = {};
    for (const g of this.pagedGroups()) all[g.partnerId] = false;
    this.expandedMembers.update((m) => ({ ...m, ...all }));
  }

  protected prev(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  protected next(): void {
    this.page.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }

  protected clearSearch(): void {
    this.query.set('');
    this.filter.set('all');
    this.memberFilter.set('all');
    this.page.set(0);
  }

  protected visibleContacts(b: DownlineContactListItem): DownlineContactListItem['contacts'] {
    if (this.isExpanded(this.batchKey(b))) return b.contacts ?? [];
    return (b.contacts ?? []).slice(0, PREVIEW_COUNT);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .downlineContactLists()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.items.set(res.data?.items ?? []);
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
