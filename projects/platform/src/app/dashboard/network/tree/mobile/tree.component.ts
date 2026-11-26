import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { CompensationService } from '../../../../core/compensation/compensation.service';
import { CommissionRank, CompensationPlan } from '../../../../core/compensation/compensation.models';
import { ApiError } from '../../../../core/http/api-error';
import { PresenceService, PresenceStatus } from '../../../../core/presence/presence.service';
import { API_BASE_URL } from '../../../../core/config/api-tokens';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { NetworkService } from '../network.service';
import { NetworkChain, NetworkNode, NetworkTreeMeta } from '../network.models';

const FALLBACK_PLAN: CompensationPlan = {
  rates: [
    { level: 1, rate: 0.09, percent: 9 },
    { level: 2, rate: 0.045, percent: 4.5 },
    { level: 3, rate: 0.025, percent: 2.5 },
    { level: 4, rate: 0.015, percent: 1.5 },
    { level: 5, rate: 0.01, percent: 1 },
  ],
  ranks: [
    { rank: 'Partner', depth: 1 },
    { rank: 'Builder', depth: 2 },
    { rank: 'Leader', depth: 3 },
    { rank: 'Ambassador', depth: 5 },
  ],
  mentorBonus: { amount: 1000, daysAfterActivation: 0 },
};

interface MobileNode {
  node: NetworkNode;
  depth: number;
}

/** Mobile drill-down view of the same network tree. */
@Component({
  selector: 'async-network-tree-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, MatButtonModule, MatButtonToggleModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Network tree</span>
      </div>
    </section>

    <section class="tree-page">
      <div class="page-head">
        <p class="eyebrow">Network</p>
        <h1>Network Tree</h1>
        <p class="subtitle">One team network — every member has one upline. Tap a partner to drill into their team.</p>
      </div>

      <div class="view-switch">
        <a mat-stroked-button routerLink="/dashboard/network/org"><mat-icon>layers</mat-icon> Org chart</a>
        <a mat-stroked-button routerLink="/dashboard/mentorship/partners/my-partners"><mat-icon>groups</mat-icon> Partners</a>
      </div>

      @if (immediateUpline(); as up) {
        <div class="upline-card" role="note">
          <async-avatar
            [photo]="avatarUrl(up.profileImage)"
            [name]="names(up)"
            size="sm"
            [presence]="presenceOf(up.id)" />
          <div class="upline-copy">
            <span class="eyebrow">{{ isSelf() ? 'Your upline' : 'Member upline' }}</span>
            <strong>{{ names(up) }}</strong>
            <span>&#64;{{ up.username }} &middot; {{ up.commissionRank }}</span>
            <span class="upline-meta">
              Earns {{ depthLabel(up.commissionDepth) }} &middot;
              {{ up.childCount }} direct partner{{ up.childCount === 1 ? '' : 's' }}
            </span>
          </div>
          <div class="upline-actions">
            <a mat-icon-button [routerLink]="['/dashboard/network/view', up.id]" aria-label="Open 360 view">
              <mat-icon>person_search</mat-icon>
            </a>
            <a mat-icon-button
              [routerLink]="['/dashboard/messages']"
              [queryParams]="{ chat: up.id, chatName: names(up) }"
              aria-label="Chat with upline">
              <mat-icon>chat</mat-icon>
            </a>
          </div>
        </div>
      } @else if (uplineReady()) {
        <div class="upline-card upline-card--empty" role="note">
          <span class="upline-mark" aria-hidden="true">?</span>
          <div class="upline-copy">
            <strong>No upline yet</strong>
            <span>You joined without a sponsor. Fair allocation places you with a campaign mentor after activation.</span>
          </div>
        </div>
      }

      @if (loading()) {
        <async-page-skeleton layout="network" [rows]="4" label="network tree" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!loading() && !error() && tree(); as root) {
        <section class="position-card">
          <div class="position-row">
            <div>
              <span class="eyebrow">{{ isSelf() ? 'Your commission position' : 'Viewing member position' }}</span>
              <strong>{{ rootRank() }} · earns {{ depthLabel(rootDepth()) }}</strong>
            </div>
            <div class="next-rank">
              @if (nextRank(); as next) {
                <span>Next rank</span>
                <strong>{{ next.rank }}</strong>
              } @else {
                <span>Top rank</span>
                <strong>Ambassador</strong>
              }
            </div>
          </div>
          <p class="hint">Rank depth controls commission levels. Earnings stop at Level 5.</p>
        </section>

        @if (upline().length > 0) {
          <div class="upline-bar">
            <button mat-button type="button" (click)="back()" [disabled]="!parentId()">
              <mat-icon>arrow_back</mat-icon>
              Up
            </button>
            <span class="upline-path">Upline · {{ upline().length }} level{{ upline().length === 1 ? '' : 's' }}</span>
          </div>
        }

        <div class="toolbar">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Search network</mat-label>
            <input matInput type="search" [value]="search()" (input)="onSearch($event)" placeholder="Username or name" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="depth-field">
            <mat-label>Depth</mat-label>
            <mat-select [value]="depth()" (selectionChange)="setDepth($event.value)">
              @for (d of depthOptions; track d) {
                <mat-option [value]="d">{{ d }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (meta(); as m) {
          <div class="stats">
            <span><strong>{{ m.total }}</strong> partners</span>
            <span><strong>{{ m.perLevel.length - 1 }}</strong> generations</span>
            @if (m.truncated) {
              <span class="warn">Partial tree — raise generations.</span>
            }
          </div>
        }

        <section class="root-card">
          <async-avatar [photo]="avatarUrl(root.profileImage)" [name]="names(root)" size="md" [presence]="presenceOf(root.id)" />
          <div class="root-copy">
            <strong>{{ names(root) }}</strong>
            <span>&#64;{{ root.username }} · {{ root.commissionRank }} · {{ root.childCount }} direct partner{{ root.childCount === 1 ? '' : 's' }}</span>
          </div>
          @if (isSelf()) {
            <span class="you-pill">You</span>
          } @else {
            <a mat-stroked-button [routerLink]="['/dashboard/network/view', root.id]">360</a>
          }
        </section>

        <div class="list-head">
          <h2>{{ searching() ? 'Search results' : 'Direct partners' }}</h2>
          <span class="muted">{{ rows().length }}</span>
        </div>

        @if (rows().length > 0) {
          <ul class="node-list">
            @for (row of rows(); track row.node.id) {
              <li class="node-card">
                <div class="node-main">
                  <async-avatar [photo]="avatarUrl(row.node.profileImage)" [name]="names(row.node)" size="sm" [presence]="presenceOf(row.node.id)" />
                  <div class="node-copy">
                    <strong>{{ names(row.node) }}</strong>
                    <span>&#64;{{ row.node.username }} · {{ row.node.commissionRank }}</span>
                    <span class="node-meta">
                      @if (searching()) { Level {{ row.depth }} · }
                      {{ relationLabel(row.node) }} · {{ row.node.childCount }} direct
                    </span>
                  </div>
                </div>
                <div class="node-actions">
                  @if (row.node.children.length > 0) {
                    <button mat-flat-button color="primary" type="button" (click)="focus(row.node.id)">
                      <mat-icon>account_tree</mat-icon>
                      Team
                    </button>
                  }
                  <a mat-stroked-button [routerLink]="['/dashboard/network/view', row.node.id]">360</a>
                  <a mat-icon-button [routerLink]="['/dashboard/messages']" [queryParams]="{ chat: row.node.id, chatName: names(row.node) }" aria-label="Chat">
                    <mat-icon>chat</mat-icon>
                  </a>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-card">
            <mat-icon>groups</mat-icon>
            <h2>{{ searching() ? 'No matches' : 'No team yet' }}</h2>
            <p>{{ searching()
              ? 'Try a different name or username, or clear the search.'
              : 'Invite someone with your referral link or wait for a campaign placement.' }}</p>
            @if (searching()) {
              <button mat-stroked-button type="button" (click)="clearSearch()">Clear search</button>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 10px; }
    .breadcrumb a { text-decoration: none; }
    .tree-page { display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; min-width: 0; }
    .page-head { display: flex; flex-direction: column; gap: 4px; }
    .page-head h1 { margin: 0; font-size: 1.9rem; letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); line-height: 1.5; }
    .view-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .view-switch a { min-height: 44px; }
    .upline-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--ms-primary) 28%, var(--ms-line)); border-radius: var(--ms-radius-lg); background: linear-gradient(120deg, color-mix(in srgb, var(--ms-primary-soft) 70%, var(--ms-surface)), var(--ms-surface)); }
    .upline-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .upline-copy strong { font-size: 0.92rem; }
    .upline-copy span { color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.35; }
    .upline-meta { font-size: 0.68rem !important; }
    .upline-actions { display: flex; align-items: center; gap: 2px; flex: none; }
    .upline-actions a { min-height: 44px; }
    .upline-mark { flex: none; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: var(--ms-primary); color: #fff; font-weight: 800; }
    .upline-card--empty { border-style: dashed; background: var(--ms-surface); }
    .root-copy { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .root-copy strong { font-size: 0.86rem; }
    .root-copy span { color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.35; }
    .position-card { padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface)); }
    .position-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .position-row > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .position-row strong { font-size: 0.95rem; }
    .next-rank { text-align: right; flex: none; }
    .next-rank span { color: var(--ms-text-muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .next-rank strong { font-size: 0.92rem; }
    .hint { margin: 8px 0 0; color: var(--ms-text-muted); font-size: 0.74rem; line-height: 1.4; }
    .upline-bar { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
    .upline-bar button { min-height: 44px; }
    .upline-path { color: var(--ms-text-muted); font-size: 0.76rem; }
    .toolbar { display: grid; grid-template-columns: minmax(0, 1fr) 88px; gap: 8px; align-items: end; }
    .search-field { width: 100%; }
    .depth-field { width: 100%; }
    .stats { display: flex; gap: 10px 16px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.76rem; }
    .stats strong { color: var(--ms-text); }
    .warn { color: var(--ms-warning); }
    .root-card { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .root-card .root-copy { flex: 1; }
    .root-card strong { font-size: 1rem; }
    .root-card span { font-size: 0.76rem; }
    .you-pill { flex: none; padding: 4px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; }
    .root-card > a { flex: none; min-height: 44px; }
    .list-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 4px; }
    .list-head h2 { margin: 0; font-size: 1.02rem; }
    .muted { color: var(--ms-text-muted); font-size: 0.78rem; }
    .node-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .node-card { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); min-width: 0; }
    .node-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .node-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .node-copy strong, .node-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .node-copy strong { font-size: 0.94rem; }
    .node-copy span { color: var(--ms-text-muted); font-size: 0.74rem; }
    .node-meta { font-size: 0.7rem !important; }
    .node-actions { display: flex; align-items: center; gap: 6px; }
    .node-actions > a, .node-actions > button { min-height: 44px; }
    .node-actions > button { flex: 1; }
    .empty-card, .alert { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 28px 18px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); }
    .alert { flex-direction: row; text-align: left; border-style: solid; background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.45; }
    .empty-card h2 { margin: 0; font-size: 1.05rem; color: var(--ms-text); }
    .empty-card p { margin: 0; line-height: 1.5; }
    .empty-card button { min-height: 44px; }
  `],
})
export class NetworkTreeMobileComponent implements OnInit {
  private readonly network = inject(NetworkService);
  private readonly auth = inject(AuthService);
  private readonly compensation = inject(CompensationService);
  private readonly presence = inject(PresenceService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tree = signal<NetworkNode | null>(null);
  protected readonly meta = signal<NetworkTreeMeta | null>(null);
  protected readonly upline = signal<NetworkNode[]>([]);
  protected readonly uplineReady = signal(false);
  protected readonly immediateUpline = computed<NetworkNode | null>(() => {
    const chain = this.upline();
    return chain.length > 0 ? chain[chain.length - 1] : null;
  });
  protected readonly rootId = signal<string | null>(null);
  protected readonly depth = signal(5);
  protected readonly plan = signal<CompensationPlan | null>(null);
  protected readonly search = signal('');
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly depthOptions = [2, 3, 4, 5, 6, 8, 10];
  protected readonly searching = computed(() => this.search().trim().length > 0);

  protected readonly ranks = computed(() => this.plan()?.ranks ?? FALLBACK_PLAN.ranks);
  protected readonly viewerRank = computed<CommissionRank>(() =>
    (this.auth.currentUser()?.commissionRank as CommissionRank | undefined) ?? 'Partner');
  protected readonly viewerDepth = computed(() =>
    this.ranks().find((r) => r.rank === this.viewerRank())?.depth ?? 1);
  protected readonly isSelf = computed(() => {
    const me = String(this.auth.currentUser()?.id ?? '');
    const root = String(this.rootId() ?? '');
    return me.length > 0 && root === me;
  });
  protected readonly rootRank = computed<CommissionRank>(() =>
    this.tree()?.commissionRank ?? this.viewerRank());
  protected readonly rootDepth = computed(() =>
    this.tree()?.commissionDepth ?? this.viewerDepth());
  protected readonly nextRank = computed(() => {
    const ranks = this.ranks();
    const index = ranks.findIndex((r) => r.rank === this.rootRank());
    return index >= 0 ? ranks[index + 1] ?? null : null;
  });
  protected readonly parentId = computed(() => {
    const chain = this.upline();
    return chain.length > 0 ? chain[chain.length - 1].id : null;
  });

  protected readonly rows = computed<MobileNode[]>(() => {
    const root = this.tree();
    if (!root) return [];
    const all: MobileNode[] = [];
    const walk = (node: NetworkNode, level: number): void => {
      all.push({ node, depth: level });
      for (const child of node.children ?? []) walk(child, level + 1);
    };
    for (const child of root.children ?? []) walk(child, 1);
    const q = this.search().trim().toLowerCase();
    if (!q) return all.filter((row) => row.depth === 1);
    return all.filter((row) =>
      `${row.node.username} ${row.node.name} ${row.node.surname}`.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.compensation.plan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.plan.set(res.data ?? null),
      error: () => this.plan.set(null),
    });
    const me = this.auth.currentUser()?.id;
    if (!me) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    this.rootId.set(me);
    this.reload();
  }

  protected reload(): void {
    const root = this.rootId();
    if (!root) return;
    this.loading.set(true);
    this.error.set(null);
    this.network.tree(root, this.depth(), 'all' as NetworkChain)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tree.set(res.data.tree);
          this.meta.set(res.data.meta);
          this.loading.set(false);
          this.refreshPresence(res.data.tree);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    this.uplineReady.set(false);
    this.network.upline(root, 'all' as NetworkChain)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const chain = [...(res.data.chain ?? [])].reverse();
          this.upline.set(chain);
          this.uplineReady.set(true);
          const immediate = chain[chain.length - 1];
          if (immediate) this.refreshPresenceIds([immediate.id]);
        },
        error: () => {
          this.upline.set([]);
          this.uplineReady.set(true);
        },
      });
  }

  protected focus(partnerId: string): void {
    this.rootId.set(partnerId);
    this.tree.set(null);
    this.meta.set(null);
    this.upline.set([]);
    this.search.set('');
    this.reload();
  }

  protected back(): void {
    const id = this.parentId();
    if (id) this.focus(id);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected setDepth(value: number): void {
    this.depth.set(value);
    this.reload();
  }

  protected names(node: { name: string; surname: string; username: string }): string {
    return this.network.displayName(node);
  }

  protected relationLabel(node: NetworkNode): string {
    return node.relationType === 'placement' ? 'Campaign placement' : 'Referral';
  }

  protected depthLabel(depth: number): string {
    return depth <= 1 ? 'Level 1' : `Levels 1–${depth}`;
  }

  protected avatarUrl(photo: string | null | undefined): string | null {
    const raw = String(photo ?? '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${this.baseUrl}/uploads/${raw.replace(/^\/+/, '')}`;
  }

  protected presenceOf(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[id] ?? null);
  }

  private refreshPresence(root: NetworkNode | null): void {
    if (!root) return;
    const ids: string[] = [];
    const queue: NetworkNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      ids.push(node.id);
      for (const child of node.children ?? []) queue.push(child);
    }
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.update((current) => ({ ...current, ...map })));
  }

  private refreshPresenceIds(ids: string[]): void {
    if (ids.length === 0) return;
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.update((current) => ({ ...current, ...map })));
  }
}
