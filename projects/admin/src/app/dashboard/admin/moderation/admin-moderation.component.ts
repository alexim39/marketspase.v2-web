import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminModerationService, ReportedPost } from './admin-moderation.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Moderation queue — reported community posts.
 *
 * Remove deletes post + comments/likes/saves/reports (cascade); dismiss
 * clears the reports and keeps the post. Both audit-wired server-side.
 * OnPush + signals, token-blind dark shells, in-card scroll on mobile.
 */
@Component({
  selector: 'async-admin-moderation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatProgressBarModule, MatTableModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Moderation</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Moderation queue</h2>
          <p class="subtitle">Member-reported posts, most-reported first. Removing is permanent.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="post">
              <th mat-header-cell *matHeaderCellDef>Post</th>
              <td mat-cell *matCellDef="let row" class="post-cell">
                <strong>{{ row.excerpt || '(no text)' }}</strong>
                <span class="muted">@{{ row.authorUsername ?? 'unknown' }} · {{ row.kind ?? 'post' }} · {{ row.postedAt | date:'mediumDate' }}</span>
                @if (row.reasons.length > 0) {
                  <span class="muted">Reported for: {{ row.reasons.join(' · ') }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="reports">
              <th mat-header-cell *matHeaderCellDef>Reports</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status dp-status--bad">{{ row.reports }}</span>
                <div class="muted">{{ row.latestAt | date:'mediumDate' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                @if (confirmId() === row.postId) {
                  <button mat-flat-button color="warn" (click)="decide(row, 'remove')" [disabled]="actingId() === row.postId">
                    {{ actingId() === row.postId ? 'Removing…' : 'Confirm remove?' }}
                  </button>
                  <button mat-button (click)="confirmId.set(null)">Cancel</button>
                } @else {
                  <button mat-button color="warn" (click)="confirmId.set(row.postId)">Remove</button>
                  <button mat-button (click)="decide(row, 'dismiss')" [disabled]="actingId() === row.postId">
                    {{ actingId() === row.postId ? 'Saving…' : 'Dismiss' }}
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} reported</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">Queue clear — no reported posts.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { color: var(--ms-success); }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .post-cell { display: flex; flex-direction: column; gap: 0.15em; max-width: 420px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .empty { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    button { min-height: 44px; }
  `],
})
export class AdminModerationComponent implements OnInit {
  private readonly mod = inject(AdminModerationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<ReportedPost[]>([]);
  protected readonly total = signal(0);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);

  protected readonly displayedColumns = ['post', 'reports', 'action'];

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.mod
      .queue({ limit: this.limit(), skip: this.skip() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected decide(row: ReportedPost, decision: 'remove' | 'dismiss'): void {
    this.actingId.set(row.postId);
    this.notice.set(null);
    this.error.set(null);
    this.mod
      .decide(row.postId, decision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.confirmId.set(null);
          this.rows.set(this.rows().filter((r) => r.postId !== row.postId));
          this.total.set(Math.max(0, this.total() - 1));
          this.notice.set(decision === 'remove' ? 'Post removed with its comments and reports.' : 'Reports dismissed — post kept.');
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.confirmId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
