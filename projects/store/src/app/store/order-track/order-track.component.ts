import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { StoreOrder } from '../store.models';
import { getOrderToken, storeError, StoreService } from '../store.service';

type ReturnDraft = { reason: string; note: string };

@Component({
  selector: 'async-store-order-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, RouterModule,
  ],
  template: `
    <section class="track-page">
      @if (loading()) {
        <div class="state-card"><h1>Loading your order…</h1><p>Checking the latest delivery status.</p></div>
      } @else if (error(); as message) {
        <div class="state-card">
          <mat-icon aria-hidden="true">receipt_long</mat-icon>
          <h1>Order not available</h1>
          <p>{{ message }}</p>
          <a class="btn" routerLink="/support">Contact support</a>
        </div>
      } @else if (order(); as o) {
        <header class="track-head">
          <p class="eyebrow">MarketSpase Store order</p>
          <h1>{{ o.orderNumber }}</h1>
          <p class="sub">{{ o.store.name }} · {{ o.createdAt | date:'medium' }}</p>
          <span class="status" [attr.data-status]="o.status">{{ statusLabel(o.status) }}</span>
        </header>

        @if (notice(); as message) { <p class="notice" role="status">{{ message }}</p> }
        @if (actionError(); as message) { <p class="error" role="alert">{{ message }}</p> }

        <div class="track-grid">
          <section class="card">
            <h2>Progress</h2>
            <ol class="timeline">
              @for (event of o.events; track event.at + event.type) {
                <li>
                  <span class="dot" aria-hidden="true"></span>
                  <div>
                    <strong>{{ eventLabel(event.type) }}</strong>
                    <small>{{ event.at | date:'medium' }}</small>
                    @if (event.note) { <p>{{ event.note }}</p> }
                  </div>
                </li>
              }
            </ol>
          </section>

          <section class="card">
            <h2>Delivery</h2>
            <p><strong>{{ o.customer.name }}</strong></p>
            <p>{{ o.customer.street }}, {{ o.customer.city }}, {{ o.customer.state }}</p>
            <p class="muted">{{ o.customer.country }}</p>
            @if (o.fulfilment.courier || o.fulfilment.trackingNumber) {
              <div class="ship-box">
                <p><span>Courier</span><strong>{{ o.fulfilment.courier || '—' }}</strong></p>
                <p><span>Tracking number</span><strong>{{ o.fulfilment.trackingNumber || '—' }}</strong></p>
                @if (o.fulfilment.trackingUrl) {
                  <a class="btn small" [href]="o.fulfilment.trackingUrl" target="_blank" rel="noopener">Open courier tracking</a>
                }
              </div>
            }
            @if (isReceived()) {
              <button mat-flat-button color="primary" type="button" (click)="markReceived()" [disabled]="busy()">
                {{ busy() ? 'Confirming…' : 'I received this order' }}
              </button>
            }
          </section>

          <section class="card">
            <h2>Items</h2>
            <div class="lines">
              @for (item of o.items; track item.storeProductId) {
                <div class="line">
                  <span>{{ item.quantity }} × {{ item.name }}</span>
                  <strong>{{ item.lineTotal | currency:'₦':'symbol':'1.0-0' }}</strong>
                </div>
              }
              <div class="line muted"><span>Delivery</span><strong>{{ o.amounts.delivery | currency:'₦':'symbol':'1.0-0' }}</strong></div>
              <div class="line total"><span>Total paid</span><strong>{{ o.amounts.total | currency:'₦':'symbol':'1.0-0' }}</strong></div>
            </div>
            @if (o.escrow.releaseAt) {
              <p class="muted">Escrow releases after {{ o.escrow.releaseAt | date:'mediumDate' }} if there is no open return.</p>
            }
          </section>

          <section class="card">
            <h2>Return or refund</h2>
            @if (returnRequest(); as request) {
              <p class="notice">Return request: <strong>{{ request.status }}</strong></p>
              @if (request.reason) { <p class="muted">{{ request.reason }}</p> }
            } @else if (canRequestReturn()) {
              <p class="muted">Tell us what went wrong. The partner reviews the request and MarketSpase approves any refund.</p>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Reason</mat-label>
                <input matInput maxlength="160" [(ngModel)]="draft.reason" placeholder="Wrong size, damaged, not as described…" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Details (optional)</mat-label>
                <textarea matInput rows="3" maxlength="1000" [(ngModel)]="draft.note"></textarea>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="requestReturn()" [disabled]="busy() || draft.reason.trim().length < 3">
                {{ busy() ? 'Sending…' : 'Request return' }}
              </button>
            } @else {
              <p class="muted">Returns open after delivery and stay available for the return window shown in the store policy.</p>
            }
          </section>
        </div>

        <div class="actions">
          <a class="btn ghost" [routerLink]="['/', o.store.slug]">Back to store</a>
          <a class="btn ghost" routerLink="/support">Need help?</a>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; background: var(--ms-canvas, #f7f5ef); min-height: 100vh; }
    .track-page { max-width: 1080px; margin: 0 auto; padding: 2em 1.2em 4em; }
    .state-card { max-width: 560px; margin: 12vh auto; text-align: center; background: #fff; border-radius: 18px; padding: 2em; }
    .state-card mat-icon { font-size: 44px; width: 44px; height: 44px; color: var(--ms-text-muted, #6b6b6b); }
    .track-head { display: grid; gap: 0.35em; padding: 1.5em 0 1em; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72em; font-weight: 800; color: var(--ms-text-muted, #6b6b6b); }
    h1 { margin: 0; font-size: clamp(1.8em, 4vw, 2.7em); }
    .sub { margin: 0; color: var(--ms-text-muted, #6b6b6b); }
    .status { width: fit-content; border-radius: 999px; padding: 0.25em 0.7em; background: #ece7db; font-weight: 800; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.04em; }
    .status[data-status="paid"], .status[data-status="processing"] { background: #fff3cd; color: #7a5a00; }
    .status[data-status="shipped"] { background: #dbeafe; color: #1d4ed8; }
    .status[data-status="delivered"] { background: #dcfce7; color: #166534; }
    .status[data-status="cancelled"], .status[data-status="refunded"] { background: #fee2e2; color: #991b1b; }
    .track-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1em; margin-top: 1em; }
    .card { background: #fff; border-radius: 16px; padding: 1.2em; display: flex; flex-direction: column; gap: 0.75em; }
    .card h2 { margin: 0; font-size: 1.05em; }
    .card p { margin: 0; line-height: 1.5; }
    .muted { color: var(--ms-text-muted, #6b6b6b); font-size: 0.9em; }
    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9em; }
    .timeline li { display: flex; gap: 0.7em; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ms-primary, #b8892f); margin-top: 0.35em; flex: none; }
    .timeline strong { display: block; font-size: 0.92em; }
    .timeline small { color: var(--ms-text-muted, #6b6b6b); }
    .timeline p { margin-top: 0.2em; font-size: 0.88em; }
    .ship-box { border-top: 1px solid #eee; padding-top: 0.7em; display: grid; gap: 0.4em; }
    .ship-box p { display: flex; justify-content: space-between; gap: 1em; }
    .ship-box span { color: var(--ms-text-muted, #6b6b6b); }
    .lines { display: flex; flex-direction: column; gap: 0.45em; }
    .line { display: flex; justify-content: space-between; gap: 1em; }
    .line.total { border-top: 1px solid #eee; padding-top: 0.55em; font-weight: 800; }
    mat-form-field { width: 100%; }
    .btn, button { min-height: 42px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.55em 1.1em; background: var(--ms-primary, #b8892f); color: #fff; text-decoration: none; font-weight: 700; width: fit-content; }
    .btn.ghost { background: transparent; color: var(--ms-text, #1c1c1c); border: 1px solid #d9d2c2; }
    .btn.small { padding: 0.4em 0.8em; font-size: 0.85em; }
    .actions { display: flex; gap: 0.6em; flex-wrap: wrap; margin-top: 1em; }
    .notice { margin: 0; color: var(--ms-success, #166534); font-weight: 600; }
    .error { margin: 0; color: var(--ms-error, #b91c1c); }
    @media (max-width: 760px) { .track-grid { grid-template-columns: 1fr; } }
  `],
})
export class StoreOrderTrackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storesApi = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly order = signal<StoreOrder | null>(null);
  protected readonly returnRequest = signal<{ status: string; reason?: string } | null>(null);
  protected readonly isReceived = computed(() => this.order()?.status === 'shipped');
  protected readonly canRequestReturn = computed(() => {
    const order = this.order();
    return Boolean(order?.deliveredAt) && order?.status === 'delivered';
  });
  protected draft: ReturnDraft = { reason: '', note: '' };
  private reference = '';
  private token = '';

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    const query = this.route.snapshot.queryParamMap;
    this.reference = String(params.get('reference') ?? '').trim();
    this.token = String(query.get('token') ?? '').trim() || getOrderToken(this.reference);
    if (!this.reference || !this.token) {
      this.loading.set(false);
      this.error.set('This tracking link is incomplete. Open the secure link from your confirmation email.');
      return;
    }
    this.load();
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending_payment: 'Awaiting payment',
      paid: 'Paid · preparing',
      processing: 'Being prepared',
      shipped: 'In transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    };
    return labels[status] ?? status;
  }

  protected eventLabel(type: string): string {
    const labels: Record<string, string> = {
      order_created: 'Order created',
      payment_confirmed: 'Payment confirmed',
      order_processing: 'Partner started preparing',
      order_shipped: 'Shipped',
      order_delivered: 'Delivered',
      order_auto_delivered: 'Delivered (automatic)',
      customer_received: 'You confirmed delivery',
      order_cancelled: 'Order cancelled',
      order_refunded: 'Refund issued',
      escrow_released: 'Escrow released to partner',
      return_requested: 'Return requested',
      return_approved: 'Return approved',
      return_rejected: 'Return rejected',
      return_received: 'Return received',
    };
    return labels[type] ?? type.replaceAll('_', ' ');
  }

  protected markReceived(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.storesApi.markOrderReceived(this.reference, this.token)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({
        next: (response) => {
          this.order.set(response.data);
          this.notice.set('Delivery confirmed — thank you.');
        },
        error: (err: unknown) => this.actionError.set(storeError(err)),
      });
  }

  protected requestReturn(): void {
    if (this.busy() || this.draft.reason.trim().length < 3) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.storesApi.requestReturn(this.reference, this.token, {
      reason: this.draft.reason.trim(),
      note: this.draft.note.trim(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({
        next: (response) => {
          this.returnRequest.set(response.data);
          this.notice.set('Return request sent. The partner will review it.');
        },
        error: (err: unknown) => this.actionError.set(storeError(err)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storesApi.getOrder(this.reference, this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.order.set(response.data);
          this.returnRequest.set((response.data as StoreOrder & { returnRequest?: { status: string; reason?: string } }).returnRequest ?? null);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.loading.set(false);
        },
      });
  }
}
