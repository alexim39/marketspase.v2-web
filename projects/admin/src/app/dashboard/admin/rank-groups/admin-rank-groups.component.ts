import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ApiError, userError } from '../../../core/http/api-error';
import {
  AdminRankGroupsService,
  RankGroupRow,
  RankGroupSyncResult,
} from './admin-rank-groups.service';

/**
 * Admin desk for the four official journey-level groups. The groups are
 * system-managed; this page reports their health, repairs membership and
 * links into the partner Messages surface for chat moderation.
 */
@Component({
  selector: 'async-admin-rank-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Rank groups</span>
      </div>
    </section>

    <section class="rank-page">
      <header class="page-head">
        <div>
          <h2>Rank groups</h2>
          <p class="subtitle">
            Official level communities for Partner, Builder, Leader and Ambassador.
            Membership follows each member's journey rank and is repaired automatically.
          </p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-flat-button color="primary" type="button" (click)="sync()" [disabled]="syncing()">
            @if (syncing()) {
              <span class="btn-inline"><span class="btn-spinner" aria-hidden="true"></span> Syncing…</span>
            } @else {
              <span class="btn-inline"><mat-icon>sync</mat-icon> Sync all members</span>
            }
          </button>
        </div>
      </header>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="load()">Retry</button></p>
      }
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading rank groups" />
      }

      <div class="rank-grid">
        @for (group of groups(); track group.rank) {
          <article class="dp-card rank-card" [class.rank-card--missing]="!group.ready">
            <div class="rank-card-head">
              <span class="rank-pill">{{ group.rank }}</span>
              <mat-icon aria-hidden="true">{{ rankIcon(group.rank) }}</mat-icon>
            </div>
            <h3>{{ group.name }}</h3>
            <p class="description">{{ group.description }}</p>
            <div class="rank-stats">
              <span><strong>{{ group.memberCount }}</strong> members</span>
              <span><strong>{{ group.adminCount }}</strong> admins</span>
              <span>{{ group.pinned ? 'Welcome pinned' : 'No pinned welcome' }}</span>
            </div>
            <div class="rank-actions">
              @if (group.groupId) {
                <a mat-stroked-button [href]="groupUrl(group.groupId)" target="_blank" rel="noopener">
                  <mat-icon>forum</mat-icon> Open group chat
                </a>
              } @else {
                <span class="missing">Not created yet — run Sync all members.</span>
              }
            </div>
          </article>
        } @empty {
          @if (!loading()) {
            <p class="empty">No rank groups returned yet. Run Sync all members to create them.</p>
          }
        }
      </div>

      <div class="dp-card note-card">
        <mat-icon aria-hidden="true">info</mat-icon>
        <div>
          <strong>How these groups work</strong>
          <p>
            Members are added and removed automatically from their journey level. They can mute the group
            but cannot leave, rename or delete it. Open a group chat here to read, reply and moderate.
            Admin and partner sessions are separate, so the partner platform may ask you to sign in once.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .rank-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.3em 0 0; max-width: 54em; color: var(--ms-text-muted); line-height: 1.55; }
    .head-actions { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .head-actions button { min-height: 44px; }
    .btn-inline { display: inline-flex; align-items: center; gap: 0.45em; }
    .btn-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
      border-top-color: currentColor; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .rank-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 1em; }
    .rank-card { display: flex; flex-direction: column; gap: 0.65em; padding: 1.2em; border-left: 4px solid var(--ms-primary); }
    .rank-card--missing { border-left-color: var(--ms-warning); opacity: 0.92; }
    .rank-card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; }
    .rank-card-head mat-icon { color: var(--ms-primary-strong); }
    .rank-card h3 { margin: 0; }
    .rank-pill {
      display: inline-flex; align-items: center; padding: 0.18em 0.65em; border-radius: 999px;
      background: var(--ms-primary-soft); color: var(--ms-primary-strong);
      font-size: 0.72em; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    }
    .description { margin: 0; color: var(--ms-text-muted); font-size: 0.9em; line-height: 1.55; flex: 1; }
    .rank-stats { display: flex; flex-wrap: wrap; gap: 0.35em 0.9em; color: var(--ms-text-muted); font-size: 0.78em; }
    .rank-stats strong { color: var(--ms-text); }
    .rank-actions { margin-top: 0.35em; }
    .rank-actions a { min-height: 44px; }
    .missing { color: var(--ms-warning); font-size: 0.82em; font-weight: 700; }
    .note-card { display: flex; align-items: flex-start; gap: 0.75em; padding: 1em 1.1em; }
    .note-card > mat-icon { color: var(--ms-primary-strong); flex: none; }
    .note-card p { margin: 0.25em 0 0; color: var(--ms-text-muted); font-size: 0.88em; line-height: 1.55; }
    .notice { margin: 0; color: var(--ms-success); font-weight: 600; }
    .error { margin: 0; color: var(--ms-error); }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class AdminRankGroupsComponent implements OnInit {
  private readonly service = inject(AdminRankGroupsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly groups = signal<RankGroupRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly syncing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groups.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected sync(): void {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.service
      .sync()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const result = res.data as RankGroupSyncResult;
          this.syncing.set(false);
          this.notice.set(this.summary(result));
          this.load();
        },
        error: (err: ApiError) => {
          this.syncing.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected groupUrl(groupId: string): string {
    return `${environment.platformUrl}/dashboard/messages?group=${encodeURIComponent(groupId)}`;
  }

  protected rankIcon(rank: RankGroupRow['rank']): string {
    if (rank === 'Partner') return 'person';
    if (rank === 'Builder') return 'construction';
    if (rank === 'Leader') return 'groups';
    return 'workspace_premium';
  }

  private summary(result: RankGroupSyncResult): string {
    const created = result.seed?.created ?? 0;
    const synced = result.sync?.synced ?? 0;
    const skipped = result.sync?.skipped ?? 0;
    return `Rank groups repaired: ${created} created, ${synced} members synced${skipped ? `, ${skipped} skipped` : ''}.`;
  }
}
