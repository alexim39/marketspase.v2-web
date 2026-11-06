import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuditEntry } from '../../../core/admin/admin.models';
import { ApiError } from '../../../core/http/api-error';

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
  'campaign.decide',
  'order.decide',
  'reservation.decide',
  'reservation.delete',
  'training.quiz.save',
  'training.media.save',
  'training.media.revert',
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
  'broadcast.send',
  'broadcast.delete',
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
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Audit log</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Audit log</h2>
          <p class="subtitle">Every admin decision, newest first — roles, payouts, withdrawals, campaigns, orders, training.</p>
        </div>
      </div>

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
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" class="loader" aria-label="Loading" />
        }
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (rows().length > 0) {
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
        <p class="empty">No audit entries yet — admin decisions will appear here.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 200px; }
    .loader { flex: 2; min-width: 120px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .empty { color: var(--ms-text-muted); }
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
