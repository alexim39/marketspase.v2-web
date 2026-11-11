import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuditEntry } from '../../../core/admin/admin.models';
import { ApiError } from '../../../core/http/api-error';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';

const ACTIONS = [
  'role.set',
  'account.suspend',
  'account.unsuspend',
  'account.signout',
  'account.reset-password',
  'account.erase',
  'account.reassign-upline',
  'payout.release',
  'payout.void',
  'withdrawal.decide',
  'wallet.credit',
  'wallet.deposit.init',
  'wallet.deposit.credit',
  'wallet.withdraw.request',
  'wallet.withdraw.paid',
  'wallet.withdraw.refund',
  'wallet.admin.credit',
  'campaign.decide',
  'order.decide',
  'reservation.decide',
  'reservation.delete',
  'training.course.create',
  'training.course.update',
  'training.course.status',
  'training.course.archive',
  'training.course.order',
  'training.lesson.create',
  'training.lesson.update',
  'training.lesson.status',
  'training.lesson.delete',
  'training.lesson.order',
  'ticket.decide',
  'lead.import',
  'lead.delete',
  'lead.status',
  'pagelead.delete',
  'pagelead.reassign',
  'partnersurvey.delete',
  'page.reset',
  'subscription.delete',
  'subscription.status',
  'billing.plan.update',
  'product.create',
  'product.update',
  'product.publish',
  'product.media.add',
  'product.media.remove',
  'weekly_video.create',
  'weekly_video.update',
  'weekly_video.schedule',
  'weekly_video.publish',
  'weekly_video.archive',
  'weekly_video.notify',
  'weekly_video.comment.hide',
  'weekly_video.comment.show',
  'broadcast.send',
  'broadcast.delete',
  'content.restore',
  'ora.action.execute',
  'ora.action.skip',
];

/**
 * @title Audit log — who did what, when.
 *
 * Append-only admin action history (roles, payouts, withdrawals,
 * campaigns, orders, training). Read-only viewer;
 * entries are written best-effort at each decision site server-side.
 * OnPush + signals, token-blind dark shells, in-card scroll on mobile.
 */
@Component({
  selector: 'async-admin-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Audit log</span>
      </div>
    </section>

    <section class="queue-page">
      <async-page-header
        eyebrow="Trust · Audit trail"
        title="Audit log."
        subtitle="Every admin decision, newest first — roles, payouts, withdrawals, campaigns, orders, training."
      />

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Action</mat-label>
          <mat-select [value]="action()" (selectionChange)="action.set($event.value); skip.set(0); reload()">
            <mat-option value="">All actions</mat-option>
            @for (a of actions; track a) {
              <mat-option [value]="a">{{ a }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Actor id</mat-label>
          <input matInput [value]="actorId()" (input)="actorId.set($any($event.target).value.trim())" placeholder="Filter by admin id" />
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
      </div>

      @if (error(); as err) {
        <async-error-state [message]="err" context="the audit log">
          <button mat-stroked-button type="button" (click)="reload()">Try again</button>
          <a mat-button routerLink="/dashboard">Back to dashboard</a>
        </async-error-state>
      }

      @if (loading()) {
        <async-page-skeleton layout="table" [rows]="6" label="audit log" [showHeader]="false" />
      }

      @if (rows().length > 0 && !loading()) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="at">
              <th mat-header-cell *matHeaderCellDef>When</th>
              <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="actor">
              <th mat-header-cell *matHeaderCellDef>Admin</th>
              <td mat-cell *matCellDef="let row" class="mono">{{ row.actorLabel ?? shortId(row.actorId) }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row"><span class="dp-status dp-status--neutral">{{ row.action }}</span></td>
            </ng-container>
            <ng-container matColumnDef="target">
              <th mat-header-cell *matHeaderCellDef>Target</th>
              <td mat-cell *matCellDef="let row" class="mono">{{ targetLabel(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="detail">
              <th mat-header-cell *matHeaderCellDef>Detail</th>
              <td mat-cell *matCellDef="let row" class="mono">{{ detailLabel(row) }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} entries</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <async-empty-state
          icon="history"
          title="No audit entries yet"
          message="No admin decision has been recorded for these filters."
          reason="No audited action matches this action or actor filter."
          next="Clear the filters or check again after your team works."
        >
          <button mat-stroked-button type="button" (click)="clearFilters()">Clear filters</button>
        </async-empty-state>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 200px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    button { min-height: 44px; }
  `],
})
export class AdminAuditComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly actions = ACTIONS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<AuditEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly limit = signal(50);
  protected readonly skip = signal(0);
  protected readonly action = signal('');
  protected readonly actorId = signal('');

  protected readonly displayedColumns = ['at', 'actor', 'action', 'target', 'detail'];

  ngOnInit(): void {
    this.reload();
  }

  protected clearFilters(): void {
    this.action.set('');
    this.actorId.set('');
    this.skip.set(0);
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .audit({ action: this.action() || undefined, actorId: this.actorId() || undefined, limit: this.limit(), skip: this.skip() })
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

  protected shortId(id: string): string {
    return id?.length > 10 ? `…${id.slice(-6)}` : (id ?? '—');
  }

  protected targetLabel(row: AuditEntry): string {
    const target = row.targetId ? this.shortId(row.targetId) : '—';
    return row.targetType ? `${row.targetType} ${target}` : target;
  }

  protected detailLabel(row: AuditEntry): string {
    const d = row.detail as Record<string, unknown> | null;
    if (!d) return '—';
    const parts: string[] = [];
    if (d['from'] !== undefined || d['to'] !== undefined) parts.push(`${d['from'] ?? '—'} → ${d['to'] ?? '—'}`);
    if (d['status'] !== undefined) parts.push(String(d['status']));
    if (d['amount'] !== undefined && d['amount'] !== null) parts.push(`₦${Number(d['amount']).toLocaleString()}`);
    if (d['code'] !== undefined && d['code'] !== null) parts.push(String(d['code']));
    if (d['questions'] !== undefined) parts.push(`${d['questions']} questions`);
    if (d['videoUrl']) parts.push('video set');
    if (d['username']) parts.push(String(d['username']));
    if (d['name']) parts.push(String(d['name']));
    return parts.length > 0 ? parts.join(' · ') : '—';
  }
}
