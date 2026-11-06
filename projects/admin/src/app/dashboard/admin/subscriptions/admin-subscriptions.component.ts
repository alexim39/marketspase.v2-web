import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminSubscriptionsService, SubscriptionRow } from './admin-subscriptions.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { timeAgo } from '../../../_common/date-util';

const csvCell = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * @title Email list — admin desk for :4201 footer subscriptions.
 *
 * Every footer subscribe lands here. KPIs show list health; search +
 * status filter slice thousands of rows server-side; Inspect reveals the
 * full row (device, referrer, join date); status toggle soft-opts people
 * out without losing history; hard Delete is two-step and audited;
 * Export downloads the filtered list as CSV. OnPush + signals.
 */
@Component({
  selector: 'async-admin-subscriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule, MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Email list</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>Email list</h2>
          <p class="subtitle">Newsletter subscriptions from the public site — inspect, opt out, remove, export.</p>
        </div>
        <button mat-button (click)="download()" [disabled]="exporting() || total() === 0">
          <mat-icon>download</mat-icon> {{ exporting() ? 'Exporting…' : 'Export CSV' }}
        </button>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
      @if (loading() && rows().length === 0) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      @if (summary(); as s) {
        <div class="kpi-grid">
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>mail</mat-icon>
            <span class="kpi-value">{{ s.total | number }}</span>
            <span class="kpi-label">Subscribers</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>fiber_new</mat-icon>
            <span class="kpi-value">{{ s.new7d | number }}</span>
            <span class="kpi-label">New 7d</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>check_circle</mat-icon>
            <span class="kpi-value">{{ s.subscribed | number }}</span>
            <span class="kpi-label">Subscribed</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>unsubscribe</mat-icon>
            <span class="kpi-value">{{ s.unsubscribed | number }}</span>
            <span class="kpi-label">Opted out</span>
          </mat-card-content></mat-card>
        </div>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search email, referrer, device</mat-label>
          <input matInput type="search" [(ngModel)]="query" (keyup.enter)="skip.set(0); reload()" maxlength="120" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All statuses</mat-option>
            <mat-option value="Subscribed">Subscribed</mat-option>
            <mat-option value="Unsubscribed">Unsubscribed</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Per page</mat-label>
          <mat-select [value]="limit()" (selectionChange)="limit.set($event.value); skip.set(0); reload()">
            <mat-option [value]="25">25</mat-option>
            <mat-option [value]="50">50</mat-option>
            <mat-option [value]="100">100</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let row" class="name-cell">{{ row.email }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status" [class]="row.status === 'Subscribed' ? 'dp-status--ok' : 'dp-status--neutral'">{{ row.status }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef>Via</th>
              <td mat-cell *matCellDef="let row">{{ row.username || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef>Joined</th>
              <td mat-cell *matCellDef="let row">{{ ageOf(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="manage">
              <th mat-header-cell *matHeaderCellDef>Manage</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="inspect(row)">Inspect</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} subscribers</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No subscribers match — clear the filters.</p>
      }

      @if (inspected(); as sub) {
        <div class="dp-card detail-card" role="region" aria-label="Subscription details">
          <h3>{{ sub.email }}</h3>
          <p class="muted">
            {{ str(sub.status) }} · via {{ sub.username || 'direct' }} · {{ sub.userDevice || 'unknown device' }} ·
            joined {{ ageOf(sub) }}
          </p>
          @if (actionError(); as aerr) {
            <p class="error" role="alert">{{ aerr }}</p>
          }
          <div class="row">
            @if (sub.status === 'Subscribed') {
              <button mat-button (click)="flip(sub, 'Unsubscribed')" [disabled]="acting()">Opt out</button>
            } @else {
              <button mat-flat-button color="primary" (click)="flip(sub, 'Subscribed')" [disabled]="acting()">Re-subscribe</button>
            }
            @if (confirmDelete() === sub.id) {
              <span class="muted">Deletes this row permanently. Re-subscribing later creates a fresh row.</span>
              <button mat-flat-button color="warn" (click)="remove(sub)" [disabled]="acting()">Confirm delete</button>
              <button mat-button (click)="confirmDelete.set(null)">Back</button>
            } @else {
              <button mat-button color="warn" (click)="confirmDelete.set(sub.id)">Delete</button>
            }
            <button mat-button (click)="inspected.set(null)">Close</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .kpi mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 150px; }
    .toolbar .search-field { flex: 1 1 200px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    .empty { color: var(--ms-text-muted); }
    .detail-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .detail-card h3 { margin: 0; }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center; }
    button { min-height: 44px; }
  `],
})
export class AdminSubscriptionsComponent implements OnInit {
  private readonly subs = inject(AdminSubscriptionsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['email', 'status', 'source', 'age', 'manage'];
  protected readonly rows = signal<SubscriptionRow[]>([]);
  protected readonly total = signal(0);
  protected readonly summary = signal<{ total: number; subscribed: number; unsubscribed: number; new7d: number } | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly exporting = signal(false);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly status = signal('all');
  protected query = '';
  protected readonly inspected = signal<SubscriptionRow | null>(null);
  protected readonly acting = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.subs
      .list({
        ...(this.query.trim() ? { q: this.query.trim() } : {}),
        ...(this.status() !== 'all' ? { status: this.status() } : {}),
        limit: this.limit(),
        skip: this.skip(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.summary.set(res.data?.summary ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected ageOf(row: SubscriptionRow): string {
    return timeAgo(new Date(row.createdAt ?? Date.now()));
  }

  protected str(v: unknown): string {
    return v === undefined || v === null ? '' : String(v);
  }

  protected inspect(row: SubscriptionRow): void {
    this.inspected.set(row);
    this.actionError.set(null);
    this.confirmDelete.set(null);
  }

  protected flip(row: SubscriptionRow, status: 'Subscribed' | 'Unsubscribed'): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.subs
      .setStatus(row.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.notice.set(res.message ?? `Marked as ${status.toLowerCase()}.`);
          this.inspected.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }

  protected remove(row: SubscriptionRow): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.subs
      .remove(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.confirmDelete.set(null);
          this.inspected.set(null);
          this.notice.set(res.message ?? 'Subscription deleted.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }

  protected download(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.subs
      .exportCsv({
        ...(this.query.trim() ? { q: this.query.trim() } : {}),
        ...(this.status() !== 'all' ? { status: this.status() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.exporting.set(false);
          const lines = ['email,status,via,device,joined', ...(data.items ?? []).map((r) =>
            [r.email, r.status, r.username, r.userDevice, r.createdAt].map(csvCell).join(','),
          )];
          if (data.capped) lines.push('# export capped at server limit — narrow the filters');
          const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'email-subscriptions.csv';
          a.click();
          URL.revokeObjectURL(url);
          this.notice.set(`Exported ${(data.items ?? []).length} rows.`);
        },
        error: (err: ApiError) => {
          this.exporting.set(false);
          this.error.set(userError(err));
        },
      });
  }
}
