import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { OnboardingService } from '../../../core/onboarding/onboarding.service';
import {
  AdminActivationOrder,
  AdminKycSubmission,
} from '../../../core/onboarding/onboarding.models';
import { ApiError, userError } from '../../../core/http/api-error';

type Tab = 'orders' | 'kyc';

@Component({
  selector: 'async-admin-activation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <section class="admin-activation">
      <div class="page-head">
        <div>
          <p class="eyebrow">Admin desk</p>
          <h1>Partner activation</h1>
          <p class="muted">Fulfil starter-product orders, review identity checks, and keep the allocation queue clean.</p>
        </div>
        <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <div class="tabs" role="tablist">
        <button type="button" [class.active]="tab() === 'orders'" (click)="setTab('orders')" role="tab">
          <mat-icon>shopping_bag</mat-icon>
          Orders
          <span>{{ ordersTotal() }}</span>
        </button>
        <button type="button" [class.active]="tab() === 'kyc'" (click)="setTab('kyc')" role="tab">
          <mat-icon>verified_user</mat-icon>
          Identity checks
          <span>{{ kycTotal() }}</span>
        </button>
      </div>

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
        </div>
      }

      @if (tab() === 'orders') {
        <div class="filters">
          @for (filter of orderFilters; track filter.value) {
            <button type="button" [class.active]="orderStatus() === filter.value" (click)="setOrderStatus(filter.value)">{{ filter.label }}</button>
          }
        </div>

        <div class="dp-card">
          @if (ordersLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (orders().length === 0 && !ordersLoading()) {
            <div class="empty"><mat-icon>inbox</mat-icon><p>No {{ orderStatus() || 'activation' }} orders.</p></div>
          } @else {
            <div class="table-wrap">
              <table>
                <thead><tr><th>Member</th><th>Order</th><th>Amount</th><th>Status</th><th>Placed</th><th></th></tr></thead>
                <tbody>
                  @for (order of orders(); track order.id) {
                    <tr>
                      <td><strong>{{ order.partner.name }}</strong></td>
                      <td><span class="mono">{{ order.orderNumber }}</span><small>{{ order.productName }}</small><small>{{ order.shipping.fullName }} · {{ order.shipping.phone }}</small><small>{{ order.shipping.street }}, {{ order.shipping.city }}, {{ order.shipping.state }}</small></td>
                      <td class="money">₦{{ order.amount | number: '1.0-0' }}</td>
                      <td><span class="chip" [class.paid]="order.status === 'Paid'" [class.done]="order.status === 'Fulfilled'" [class.refunded]="order.status === 'Refunded'">{{ order.status }}</span></td>
                      <td>{{ order.activatedAt | date: 'mediumDate' }}</td>
                      <td class="actions">
                        @if (order.status === 'Paid') {
                          <button mat-stroked-button type="button" (click)="fulfil(order)" [disabled]="busyId() === order.id">Fulfil</button>
                        }
                        @if (order.status === 'Paid' || order.status === 'Fulfilled') {
                          <button mat-button type="button" class="danger" (click)="startRefund(order)" [disabled]="busyId() === order.id">Refund</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        @if (refundTarget(); as target) {
          <div class="dp-card action-panel">
            <div>
              <p class="eyebrow">Refund activation</p>
              <h3>{{ target.orderNumber }} · {{ target.partner.name }}</h3>
              <p class="muted">This credits ₦{{ target.amount | number: '1.0-0' }} back to the member wallet, returns the account to member status, and cancels the queue entry.</p>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>Refund reason</mat-label>
              <textarea matInput rows="2" [ngModel]="refundReason()" (ngModelChange)="refundReason.set($event)" placeholder="Faulty product, chargeback, admin correction…"></textarea>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="button" (click)="submitRefund()" [disabled]="busyId() === target.id || refundReason().trim().length < 3">Confirm refund</button>
              <button mat-button type="button" (click)="cancelRefund()">Cancel</button>
            </div>
          </div>
        }
      } @else {
        <div class="filters">
          @for (filter of kycFilters; track filter.value) {
            <button type="button" [class.active]="kycStatus() === filter.value" (click)="setKycStatus(filter.value)">{{ filter.label }}</button>
          }
        </div>

        <div class="dp-card">
          @if (kycLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (kycRows().length === 0 && !kycLoading()) {
            <div class="empty"><mat-icon>task_alt</mat-icon><p>No {{ kycStatus() || 'identity' }} submissions.</p></div>
          } @else {
            <div class="kyc-list">
              @for (row of kycRows(); track row.partner.id) {
                <article class="kyc-row">
                  <div class="kyc-main">
                    <div class="avatar">{{ initials(row.partner.name) }}</div>
                    <div>
                      <strong>{{ row.partner.name }}</strong>
                      <p class="muted">{{ idTypeLabel(row.idType) }} ending {{ row.idLast4 }} · {{ row.address }}, {{ row.city }}, {{ row.state }}</p>
                      <small class="muted">{{ row.partner.email }} · Born {{ row.dateOfBirth | date: 'mediumDate' }} · Submitted {{ row.submittedAt | date: 'medium' }}</small>
                    </div>
                  </div>
                  <span class="chip" [class.done]="row.status === 'verified'" [class.refunded]="row.status === 'rejected'">{{ row.status }}</span>
                  @if (row.status === 'pending') {
                    <div class="actions">
                      <button mat-stroked-button type="button" (click)="verify(row)" [disabled]="busyId() === row.partner.id">Verify</button>
                      <button mat-button type="button" class="danger" (click)="startReject(row)" [disabled]="busyId() === row.partner.id">Reject</button>
                    </div>
                  }
                </article>
              }
            </div>
          }
        </div>

        @if (rejectTarget(); as target) {
          <div class="dp-card action-panel">
            <div>
              <p class="eyebrow">Reject identity check</p>
              <h3>{{ target.partner.name }}</h3>
              <p class="muted">The member sees this note and can correct the submission. An activated partner needs a separate refund action if activation must be reversed.</p>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>Reason shown to the member</mat-label>
              <textarea matInput rows="2" [ngModel]="rejectNote()" (ngModelChange)="rejectNote.set($event)" placeholder="Document unclear, name mismatch, expired document…"></textarea>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="button" (click)="submitReject()" [disabled]="busyId() === target.partner.id || rejectNote().trim().length < 3">Reject submission</button>
              <button mat-button type="button" (click)="cancelReject()">Cancel</button>
            </div>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .admin-activation { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
    .page-head h1 { margin: 4px 0 6px; font-size: clamp(1.6rem, 3vw, 2.1rem); }
    .page-head p { margin: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .tabs button, .filters button { border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 9px 14px; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font: inherit; }
    .tabs button span { background: var(--ms-canvas); border-radius: 999px; padding: 1px 7px; font-size: 0.78rem; }
    .tabs button.active, .filters button.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .tabs mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .filters { display: flex; gap: 7px; margin-bottom: 12px; flex-wrap: wrap; }
    .filters button { padding: 6px 12px; font-size: 0.82rem; }
    .dp-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { text-align: left; padding: 13px 14px; border-bottom: 1px solid var(--ms-line); vertical-align: middle; }
    th { color: var(--ms-text-muted); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }
    tbody tr:last-child td { border-bottom: 0; }
    td small, td .mono { display: block; }
    td small { color: var(--ms-text-muted); font-size: 0.76rem; }
    .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.82rem; }
    .money { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 700; }
    .chip { display: inline-flex; border-radius: 999px; padding: 4px 9px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .chip.paid { background: var(--ms-info-soft); color: var(--ms-info); }
    .chip.done { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.refunded { background: var(--ms-error-soft); color: var(--ms-error); }
    .actions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
    .danger { color: var(--ms-error); }
    .empty { display: grid; place-items: center; gap: 6px; padding: 46px 20px; color: var(--ms-text-muted); }
    .empty mat-icon { font-size: 34px; width: 34px; height: 34px; }
    .empty p { margin: 0; }
    .alert { display: flex; gap: 10px; align-items: flex-start; background: var(--ms-error-soft); color: var(--ms-error); padding: 12px 14px; border-radius: 12px; margin-bottom: 14px; }
    .alert p { margin: 0; flex: 1; }
    .action-panel { padding: 18px; display: grid; gap: 10px; }
    .action-panel h3 { margin: 3px 0 5px; }
    .action-panel p { margin: 0; line-height: 1.5; }
    .kyc-list { display: grid; }
    .kyc-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-bottom: 1px solid var(--ms-line); flex-wrap: wrap; }
    .kyc-row:last-child { border-bottom: 0; }
    .kyc-main { display: flex; gap: 11px; align-items: center; flex: 1; min-width: 260px; }
    .kyc-main p { margin: 3px 0; line-height: 1.45; }
    .avatar { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    @media (max-width: 700px) {
      .admin-activation { padding: 16px; }
      .page-head { flex-direction: column; }
    }
  `],
})
export class AdminActivationComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly snack = inject(MatSnackBar);

  protected readonly tab = signal<Tab>('orders');
  protected readonly orders = signal<AdminActivationOrder[]>([]);
  protected readonly kycRows = signal<AdminKycSubmission[]>([]);
  protected readonly ordersTotal = signal(0);
  protected readonly kycTotal = signal(0);
  protected readonly ordersLoading = signal(false);
  protected readonly kycLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly orderStatus = signal('');
  protected readonly kycStatus = signal('pending');
  protected readonly refundTarget = signal<AdminActivationOrder | null>(null);
  protected readonly refundReason = signal('');
  protected readonly rejectTarget = signal<AdminKycSubmission | null>(null);
  protected readonly rejectNote = signal('');

  protected readonly orderFilters = [
    { label: 'Paid', value: 'Paid' },
    { label: 'Fulfilled', value: 'Fulfilled' },
    { label: 'Refunded', value: 'Refunded' },
    { label: 'All', value: '' },
  ];

  protected readonly kycFilters = [
    { label: 'Pending', value: 'pending' },
    { label: 'Verified', value: 'verified' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: '' },
  ];

  ngOnInit(): void {
    this.reload();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'orders' && this.orders().length === 0) this.loadOrders();
    if (tab === 'kyc' && this.kycRows().length === 0) this.loadKyc();
  }

  protected setOrderStatus(status: string): void {
    this.orderStatus.set(status);
    this.loadOrders();
  }

  protected setKycStatus(status: string): void {
    this.kycStatus.set(status);
    this.loadKyc();
  }

  protected reload(): void {
    this.loading.set(true);
    this.loadOrders();
    this.loadKyc();
  }

  protected fulfil(order: AdminActivationOrder): void {
    this.busyId.set(order.id);
    this.error.set(null);
    this.onboarding.fulfillOrder(order.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: (response) => {
        const release = response.data?.autoRelease;
        if (release?.released) {
          const count = release.released;
          this.snack.open(
            `Order fulfilled — ${count} commission ${count === 1 ? 'entry' : 'entries'} released`,
            'Close',
            { duration: 5000 },
          );
        } else if (release?.error) {
          this.snack.open('Order fulfilled — commission release will retry automatically', 'Close', { duration: 5000 });
        } else {
          this.snack.open('Order marked fulfilled', 'Close', { duration: 3000 });
        }
        this.loadOrders();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected startRefund(order: AdminActivationOrder): void {
    this.refundTarget.set(order);
    this.refundReason.set('');
  }

  protected cancelRefund(): void {
    this.refundTarget.set(null);
    this.refundReason.set('');
  }

  protected submitRefund(): void {
    const target = this.refundTarget();
    const reason = this.refundReason().trim();
    if (!target || reason.length < 3) return;
    this.busyId.set(target.id);
    this.error.set(null);
    this.onboarding.refundOrder(target.id, reason).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open('Activation refunded and wallet credited', 'Close', { duration: 4000 });
        this.cancelRefund();
        this.loadOrders();
        this.loadKyc();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected verify(row: AdminKycSubmission): void {
    this.busyId.set(row.partner.id);
    this.error.set(null);
    this.onboarding.verifyKyc(row.partner.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open('Identity verified', 'Close', { duration: 3000 });
        this.loadKyc();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected startReject(row: AdminKycSubmission): void {
    this.rejectTarget.set(row);
    this.rejectNote.set('');
  }

  protected cancelReject(): void {
    this.rejectTarget.set(null);
    this.rejectNote.set('');
  }

  protected submitReject(): void {
    const target = this.rejectTarget();
    const note = this.rejectNote().trim();
    if (!target || note.length < 3) return;
    this.busyId.set(target.partner.id);
    this.error.set(null);
    this.onboarding.rejectKyc(target.partner.id, note).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open('Identity submission rejected', 'Close', { duration: 3000 });
        this.cancelReject();
        this.loadKyc();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected idTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      nin: 'NIN',
      drivers_license: "Driver's licence",
      passport: 'Passport',
      voters_card: "Voter's card",
    };
    return labels[type] ?? type;
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
  }

  private loadOrders(): void {
    this.ordersLoading.set(true);
    this.onboarding.adminOrders({ status: this.orderStatus() || undefined }).pipe(
      finalize(() => {
        this.ordersLoading.set(false);
        this.loading.set(false);
      }),
    ).subscribe({
      next: (response) => {
        this.orders.set(response.data);
        this.ordersTotal.set(response.meta.total);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadKyc(): void {
    this.kycLoading.set(true);
    this.onboarding.adminKyc({ status: this.kycStatus() || undefined }).pipe(
      finalize(() => {
        this.kycLoading.set(false);
        this.loading.set(false);
      }),
    ).subscribe({
      next: (response) => {
        this.kycRows.set(response.data);
        this.kycTotal.set(response.meta.total);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
