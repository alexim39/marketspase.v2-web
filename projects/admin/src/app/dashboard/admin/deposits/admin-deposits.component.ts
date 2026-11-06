import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { LookupHit, ManualClaimRow, WalletService } from '../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../core/http/api-error';

type QueueFilter = 'awaiting-review' | 'approved' | 'rejected' | 'all';

/**
 * @title Manual deposits — admin confirmation desk.
 *
 * Top: the transfer-claim queue (approve credits the wallet exactly once;
 * reject forces a reason; every move is audited server-side and the member
 * is notified). Bottom: direct wallet credit — partner lookup, amount,
 * mandatory reason, confirm screen with before/after balance. OnPush.
 */
@Component({
  selector: 'async-admin-deposits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule,
    MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Manual deposits</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Manual deposits</h2>
          <p class="subtitle">New bank-transfer claims are disabled. This queue is historical — confirm old claims against the statement, or reject with a reason.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status"><mat-icon>check_circle</mat-icon> {{ note }}</p>
      }
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="filter()" (selectionChange)="filter.set($event.value); reload()">
            @for (f of filters; track f) {
              <mat-option [value]="f">{{ f === 'all' ? 'All statuses' : f }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="owner">
              <th mat-header-cell *matHeaderCellDef>Partner</th>
              <td mat-cell *matCellDef="let row" class="name-cell">
                {{ row.partner?.name ?? '—' }}
                <span class="muted">{{ row.partner?.email ?? '' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let row" class="num-cell">₦{{ row.amountNgn | number }}</td>
            </ng-container>
            <ng-container matColumnDef="evidence">
              <th mat-header-cell *matHeaderCellDef>Transfer evidence</th>
              <td mat-cell *matCellDef="let row">
                → {{ claim(row, 'destinationAccount') }} · from {{ claim(row, 'senderName') }} ({{ claim(row, 'senderAccount') }})
                <span class="muted">ref {{ claim(row, 'bankReference') }} · {{ claim(row, 'paidAt') | date:'mediumDate' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef>Waiting</th>
              <td mat-cell *matCellDef="let row">{{ ageInQueue(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status {{ statusTone(row.status) }}">{{ row.status }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                @if (row.status === 'awaiting-review') {
                  @if (deciding() === row.reference) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="reason-field">
                      <mat-label>Note (required to reject)</mat-label>
                      <input matInput [(ngModel)]="decisionNote" maxlength="500" />
                    </mat-form-field>
                    <div class="confirm-row">
                      <button mat-flat-button color="primary" (click)="decide(row, 'approve')" [disabled]="acting()">Approve + credit</button>
                      <button mat-button (click)="decide(row, 'reject')" [disabled]="acting() || decisionNote.trim().length < 3">Reject</button>
                      <button mat-button (click)="deciding.set(null)">Cancel</button>
                    </div>
                  } @else {
                    <button mat-button (click)="deciding.set(row.reference); decisionNote = ''" [disabled]="acting()">Review</button>
                  }
                } @else {
                  <span class="muted">{{ row.decisionNote ?? '—' }}</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
      } @else if (!loading()) {
        <p class="empty">Queue clear — no claims{{ filter() === 'all' ? '' : ' under ' + filter() }}.</p>
      }

      <div class="dp-card credit-card">
        <h3>Credit a wallet directly</h3>
        <p class="muted">For bonuses and corrections. Needs a reason — every credit is audited and the member is notified.</p>
        <mat-form-field appearance="outline">
          <mat-label>Find partner (email or username)</mat-label>
          <input matInput [(ngModel)]="query" (keyup.enter)="search()" minlength="2" />
        </mat-form-field>
        <div class="row">
          <button mat-button (click)="search()" [disabled]="query.trim().length < 2 || searching()">Search</button>
        </div>
        @if (searching()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
        }
        @if (hits().length > 0) {
          <div class="hits">
            @for (h of hits(); track h.id) {
              <button mat-button [class.active]="picked()?.id === h.id" (click)="picked.set(h)">
                {{ h.name }} · {{ h.username ?? h.email }} · ₦{{ h.balance | number }}
              </button>
            }
          </div>
        }
        @if (picked(); as p) {
          <div class="credit-form">
            <p><strong>{{ p.name }}</strong> <span class="muted">{{ p.email }} · balance ₦{{ p.balance | number }}</span></p>
            <mat-form-field appearance="outline">
              <mat-label>Amount (₦)</mat-label>
              <input matInput type="number" [(ngModel)]="creditAmount" min="1" max="10000000" step="100" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Reason (min 5 characters)</mat-label>
              <input matInput [(ngModel)]="creditReason" maxlength="500" />
            </mat-form-field>
            @if (creditError(); as cerr) {
              <p class="error" role="alert">{{ cerr }}</p>
            }
            @if (!confirmCredit()) {
              <button mat-flat-button color="primary" (click)="confirmCredit.set(true)" [disabled]="!creditValid()">Review credit</button>
            } @else {
              <p role="status">Credit <strong>₦{{ creditAmount | number }}</strong> to <strong>{{ p.name }}</strong>?
                Balance ₦{{ p.balance | number }} → ₦{{ (p.balance + (creditAmount || 0)) | number }}.</p>
              <div class="row">
                <button mat-flat-button color="primary" (click)="doCredit()" [disabled]="crediting()">Confirm credit</button>
                <button mat-button (click)="confirmCredit.set(false)">Back</button>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { display: flex; align-items: center; gap: 0.4em; color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; min-width: 760px; }
    .name-cell .muted, .muted { color: var(--ms-text-muted); font-size: 0.85em; display: block; }
    .num-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .reason-field { width: min(320px, 100%); }
    .confirm-row { display: flex; gap: 0.4em; flex-wrap: wrap; margin-top: 0.4em; }
    .empty { color: var(--ms-text-muted); }
    .credit-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; max-width: 640px; }
    .credit-card h3 { margin: 0; }
    .hits { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .hits button.active { border: 1px solid var(--ms-primary); font-weight: 700; }
    .credit-form { display: flex; flex-direction: column; gap: 0.6em; }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; }
    button { min-height: 44px; }
  `],
})
export class AdminDepositsComponent implements OnInit {
  private readonly wallet = inject(WalletService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly filters: QueueFilter[] = ['awaiting-review', 'approved', 'rejected', 'all'];
  protected readonly columns = ['owner', 'amount', 'evidence', 'age', 'status', 'action'];
  protected readonly filter = signal<QueueFilter>('awaiting-review');
  protected readonly rows = signal<ManualClaimRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly deciding = signal<string | null>(null);
  protected readonly acting = signal(false);
  protected decisionNote = '';

  protected query = '';
  protected readonly searching = signal(false);
  protected readonly hits = signal<LookupHit[]>([]);
  protected readonly picked = signal<LookupHit | null>(null);
  protected creditAmount: number | null = null;
  protected creditReason = '';
  protected readonly confirmCredit = signal(false);
  protected readonly crediting = signal(false);
  protected readonly creditError = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.wallet
      .manualQueue(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected claim(row: ManualClaimRow, key: string): string {
    const v = row.claim?.[key];
    return v === undefined || v === null ? '—' : String(v);
  }

  protected statusTone(status: string): string {
    if (status === 'approved') return 'dp-status--ok';
    if (status === 'rejected') return 'dp-status--bad';
    return 'dp-status--warn';
  }

  protected ageInQueue(row: ManualClaimRow): string {
    const ms = Date.now() - new Date(row.createdAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  protected decide(row: ManualClaimRow, decision: 'approve' | 'reject'): void {
    if (this.acting()) return;
    if (decision === 'reject' && this.decisionNote.trim().length < 3) return;
    this.acting.set(true);
    this.wallet
      .decideManualDeposit(row.reference, decision, this.decisionNote.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.deciding.set(null);
          this.decisionNote = '';
          this.notice.set(res.message ?? (decision === 'approve' ? 'Wallet credited.' : 'Claim rejected.'));
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected search(): void {
    const q = this.query.trim();
    if (q.length < 2 || this.searching()) return;
    this.searching.set(true);
    this.hits.set([]);
    this.picked.set(null);
    this.wallet
      .lookupPartner(q)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res.data ?? { exact: null, matches: [] };
          if (data.exact) {
            this.hits.set([data.exact]);
            this.picked.set(data.exact);
          } else {
            this.hits.set(data.matches ?? []);
          }
          this.searching.set(false);
        },
        error: (err: ApiError) => {
          this.searching.set(false);
          this.creditError.set(userError(err));
        },
      });
  }

  protected creditValid(): boolean {
    const a = Number(this.creditAmount);
    return !!this.picked() && Number.isFinite(a) && a >= 1 && a <= 10000000
      && this.creditReason.trim().length >= 5;
  }

  protected doCredit(): void {
    const p = this.picked();
    if (!p || !this.creditValid() || this.crediting()) return;
    this.crediting.set(true);
    this.creditError.set(null);
    this.wallet
      .adminCredit(p.id, Number(this.creditAmount), this.creditReason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.crediting.set(false);
          this.confirmCredit.set(false);
          this.notice.set(res.message ?? `₦${Number(this.creditAmount).toLocaleString()} credited to ${p.name}.`);
          this.picked.set({ ...p, balance: p.balance + Number(this.creditAmount) });
          this.creditAmount = null;
          this.creditReason = '';
        },
        error: (err: ApiError) => {
          this.crediting.set(false);
          this.creditError.set(userError(err));
        },
      });
  }
}
