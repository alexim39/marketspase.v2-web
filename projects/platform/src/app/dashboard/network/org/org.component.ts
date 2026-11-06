import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { ApiError } from '../../../core/http/api-error';
import { NetworkService } from '../tree/network.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { NetworkNode, NetworkTreeMeta } from '../tree/network.models';

interface OrgLevel {
  depth: number;
  members: NetworkNode[];
  leaders: number;
}

/**
 * @title Organization chart — breadth-first view of the network.
 *
 * Where the tree shows lineage, this shows levels: span of control,
 * widest bench, leaders per band. Click a member to focus their subtree.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-org-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Network</a> &gt;
        <span>Org Chart</span>
      </div>
    </section>

    <section class="org-page">
      <div class="page-head">
        <div>
          <h2>Organization Chart</h2>
          <p class="subtitle">Generation by generation — who sits where, their commission rank, and how wide each bench is.</p>
        </div>
        <div class="head-links">
          <a mat-button routerLink="../tree">Tree view</a>
        </div>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search members</mat-label>
          <input matInput type="search" placeholder="Username or name" (input)="search.set($any($event.target).value)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="depth-field">
          <mat-label>Generations to show</mat-label>
          <mat-select [value]="depth()" (selectionChange)="depth.set($event.value); reload()">
            @for (d of depthOptions; track d) {
              <mat-option [value]="d">{{ d }} generations</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" class="loader" aria-label="Loading" />
        }
      </div>

      <p class="depth-hint">
        Generation depth is a view control only. Commission earnings stop at Level 5 — Partner L1, Builder L1–2,
        Leader L1–3, Ambassador L1–5.
      </p>

      @if (meta(); as m) {
        <div class="stats">
          <span><strong>{{ m.total }}</strong> partners</span>
          <span>Span of control: <strong>{{ spanOfControl() }}</strong></span>
          <span>Widest generation: <strong>{{ widestLevel() }}</strong></span>
          @if (m.truncated) {
            <span class="warn">Partial data — raise depth or focus a subtree.</span>
          }
        </div>
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (levels().length > 0) {
        <ol class="levels">
          @for (level of levels(); track level.depth) {
            <li class="level dp-card">
              <button class="level-head" (click)="toggleLevel(level.depth)" [attr.aria-expanded]="!isCollapsed(level.depth)">
                <mat-icon>{{ isCollapsed(level.depth) ? 'expand_more' : 'expand_less' }}</mat-icon>
                <strong>Generation {{ level.depth }}</strong>
                <span class="muted">{{ level.members.length }} members · {{ level.leaders }} Leader/Ambassador ranks</span>
              </button>
              @if (!isCollapsed(level.depth)) {
                <div class="members">
                  @for (member of level.members; track member.id) {
                    <button
                      class="member"
                      [class.member--match]="isMatch(member)"
                      (click)="select(member)"
                      [title]="names(member)"
                      [attr.aria-label]="'View ' + names(member)"
                    >
                      <async-avatar [photo]="member.profileImage" [name]="names(member)" size="sm" [presence]="presenceOf(member.id)" />
                      <span class="member-name">{{ names(member) }}</span>
                      <span class="rank-chip">{{ member.commissionRank }} · L1–{{ member.commissionDepth }}</span>
                      <span class="muted">@{{ member.username }} · {{ member.childCount }}</span>
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ol>

        @if (selected(); as detail) {
          <div class="details" role="status">
            <div>
              <strong>{{ names(detail) }}</strong>
              <span class="muted">@{{ detail.username }} · {{ detail.commissionRank }} · earns L1–{{ detail.commissionDepth }} · {{ detail.childCount }} downlines</span>
            </div>
            <span class="spacer"></span>
            <button mat-flat-button color="primary" (click)="focus(detail.id)">Focus subtree</button>
          </div>
        }
      } @else if (!loading() && !error()) {
        <p class="empty">No downlines yet — converted prospects will appear here.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .org-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .head-links { display: flex; gap: 0.25em; }
    .toolbar { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .toolbar mat-form-field { flex: 1; min-width: 200px; }
    .depth-field { max-width: 150px; }
    .loader { flex: 2; min-width: 120px; }
    .depth-hint { margin: 0; color: var(--ms-text-muted); font-size: 0.85em; line-height: 1.45; }
    .stats { display: flex; gap: 1.5em; align-items: center; flex-wrap: wrap; }
    .warn { color: var(--ms-warning); }
    .levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; counter-reset: level; }
    .level { padding: 0.75em 1em; }
    .level-head { display: flex; align-items: center; gap: 0.6em; background: none; border: none; cursor: pointer; padding: 0; color: inherit; font: inherit; width: 100%; text-align: left; }
    .level-head mat-icon { color: var(--ms-primary-strong); }
    .members { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6em; margin-top: 0.75em; }
    .member { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15em; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.75em; cursor: pointer; color: inherit; font: inherit; text-align: left; }
    .member:hover { border-color: var(--ms-primary); }
    .member--match { border-color: var(--ms-success); border-width: 2px; }
    .member async-avatar { margin-bottom: 0.15em; }
    .member-name { font-weight: 600; }
    .rank-chip { background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 2px 8px; font-size: 0.72em; font-weight: 700; white-space: nowrap; }
    .details { display: flex; align-items: center; gap: 1em; background: var(--ms-info-soft); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.75em 1em; flex-wrap: wrap; }
    .details .spacer { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class OrgChartComponent implements OnInit {
  private readonly network = inject(NetworkService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tree = signal<NetworkNode | null>(null);
  protected readonly meta = signal<NetworkTreeMeta | null>(null);
  protected readonly rootId = signal<string | null>(null);
  protected readonly depth = signal(4);
  protected readonly search = signal('');
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedId = signal<string | null>(null);

  /** memberId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});

  protected readonly depthOptions = [2, 3, 4, 5, 6, 8, 10];

  /** Breadth-first levels over the loaded tree (search filters members). */
  protected readonly levels = computed<OrgLevel[]>(() => {
    const root = this.tree();
    if (!root) return [];
    const q = this.search().trim().toLowerCase();
    const bands = new Map<number, NetworkNode[]>();
    const queue: Array<{ node: NetworkNode; depth: number }> = [{ node: root, depth: 0 }];
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (!bands.has(depth)) bands.set(depth, []);
      bands.get(depth)!.push(node);
      for (const child of node.children ?? []) queue.push({ node: child, depth: depth + 1 });
    }
    return [...bands.entries()]
      .sort(([a], [b]) => a - b)
      .map(([depth, members]) => {
        const filtered = q
          ? members.filter((m) => `${m.username} ${m.name} ${m.surname}`.toLowerCase().includes(q))
          : members;
        return {
          depth,
          members: filtered,
          leaders: members.filter((m) => m.commissionRank === 'Leader' || m.commissionRank === 'Ambassador').length,
        };
      })
      .filter((level) => level.members.length > 0);
  });

  protected readonly spanOfControl = computed(() => this.levels().find((l) => l.depth === 1)?.members.length ?? 0);

  protected readonly widestLevel = computed(() => {
    const levels = this.levels();
    if (levels.length === 0) return '—';
    const widest = levels.reduce((a, b) => (b.members.length > a.members.length ? b : a));
    return `G${widest.depth} (${widest.members.length})`;
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    for (const level of this.levels()) {
      const found = level.members.find((m) => m.id === id);
      if (found) return found;
    }
    return null;
  });

  ngOnInit(): void {
    const me = this.auth.currentUser()?.id;
    if (me) {
      this.rootId.set(me);
      this.reload();
    } else {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
    }
  }

  protected reload(): void {
    const root = this.rootId();
    if (!root) return;
    this.loading.set(true);
    this.error.set(null);
    this.network
      .tree(root, this.depth())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tree.set(res.data.tree);
          this.meta.set(res.data.meta);
          this.collapsed.set(new Set());
          this.selectedId.set(null);
          this.loading.set(false);
          this.refreshPresence(res.data.tree);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  /** One bulk presence lookup over every loaded member (cached 60s). */
  protected refreshPresence(root: NetworkNode | null): void {
    if (!root) return;
    const ids: string[] = [];
    const queue: NetworkNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      ids.push(node.id);
      for (const child of node.children ?? []) queue.push(child);
    }
    this.presence
      .lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
  }

  protected presenceOf(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[id] ?? null);
  }

  protected focus(partnerId: string): void {
    this.rootId.set(partnerId);
    this.search.set('');
    this.reload();
  }

  protected toggleLevel(depth: number): void {
    const next = new Set(this.collapsed());
    if (next.has(depth)) {
      next.delete(depth);
    } else {
      next.add(depth);
    }
    this.collapsed.set(next);
  }

  protected isCollapsed(depth: number): boolean {
    return this.collapsed().has(depth);
  }

  protected select(member: NetworkNode): void {
    this.selectedId.set(this.selectedId() === member.id ? null : member.id);
  }

  protected isMatch(member: NetworkNode): boolean {
    const q = this.search().trim().toLowerCase();
    if (!q) return false;
    return `${member.username} ${member.name} ${member.surname}`.toLowerCase().includes(q);
  }

  protected names(node: { name: string; surname: string; username: string }): string {
    return this.network.displayName(node);
  }

  protected initial(node: { name: string; username: string }): string {
    return (node.name?.charAt(0) ?? node.username?.charAt(0) ?? '?').toUpperCase();
  }
}
