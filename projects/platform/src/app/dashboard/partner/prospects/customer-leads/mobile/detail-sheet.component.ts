import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { StoreCustomerLead } from '../../../../../core/store/store.models';
import { CustomerLeadsFacade } from '../state/customer-leads.facade';

/** Full-screen mobile customer profile sheet. */
@Component({
  selector: 'async-customer-detail-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatIconModule, RouterModule],
  template: `
    @if (selected(); as customer) {
      <div class="detail-sheet" role="dialog" aria-modal="true" aria-label="Customer details">
        <header class="detail-topbar">
          <button mat-icon-button type="button" (click)="close()" aria-label="Back to customers"><mat-icon>arrow_back</mat-icon></button>
          <span>Customer profile</span>
          <button mat-icon-button type="button" (click)="load()" [disabled]="loading()" aria-label="Refresh customers"><mat-icon>refresh</mat-icon></button>
        </header>

        <div class="detail-scroll">
          <section class="profile-hero">
            <span [class]="'avatar avatar--lg avatar--' + segmentFor(customer).tone">{{ initial(customer) }}</span>
            <h2>{{ customer.name || 'Customer' }}</h2>
            <div class="hero-chips">
              <span [class]="'segment-pill segment-pill--' + segmentFor(customer).tone">{{ segmentFor(customer).label }}</span>
              <span [class]="'state-chip state-chip--' + customer.status.toLowerCase()">{{ customer.status }}</span>
              @if (customer.consentToContact) {
                <span class="consent-chip"><mat-icon aria-hidden="true">verified_user</mat-icon>Opted in</span>
              } @else {
                <span class="state-chip">Order contact only</span>
              }
            </div>
            <div class="hero-contact">
              @if (customer.phone) { <a [href]="'tel:' + customer.phone"><mat-icon aria-hidden="true">call</mat-icon>{{ customer.phone }}</a> }
              @if (customer.email) { <a [href]="email(customer)"><mat-icon aria-hidden="true">mail</mat-icon>{{ customer.email }}</a> }
            </div>
            @if (customer.tags?.length) {
              <div class="tag-row">
                @for (tag of customer.tags; track tag) { <span>{{ tag }}</span> }
              </div>
            }
          </section>

          <section class="quick-contact" aria-label="Contact customer">
            @if (customer.phone) {
              <a class="quick-btn" [href]="'tel:' + customer.phone" (click)="recordOutreach(customer, 'call')">
                <span class="quick-icon quick-icon--call"><mat-icon aria-hidden="true">call</mat-icon></span>
                <span>Call</span>
              </a>
            }
            @if (customer.consentToContact && customer.phone) {
              <a class="quick-btn" [href]="whatsapp(customer.phone, customer.name, reorderMessage(customer))" target="_blank" rel="noopener" (click)="recordOutreach(customer, 'whatsapp')">
                <span class="quick-icon quick-icon--wa"><mat-icon aria-hidden="true">chat</mat-icon></span>
                <span>WhatsApp</span>
              </a>
              <a class="quick-btn" [routerLink]="['/dashboard/messages/sms']" [queryParams]="{ customerLead: customer.id }">
                <span class="quick-icon quick-icon--sms"><mat-icon aria-hidden="true">sms</mat-icon></span>
                <span>SMS</span>
              </a>
            }
            @if (customer.email) {
              <a class="quick-btn" [href]="email(customer, reorderMessage(customer))" (click)="recordOutreach(customer, 'email')">
                <span class="quick-icon quick-icon--mail"><mat-icon aria-hidden="true">mail</mat-icon></span>
                <span>Email</span>
              </a>
            }
          </section>

          @if (!customer.consentToContact) {
            <div class="consent-note" role="note">
              <mat-icon aria-hidden="true">info</mat-icon>
              <span>This customer did not opt in to marketing updates. Only contact them about their order.</span>
            </div>
          }

          <section class="detail-stats" aria-label="Customer value">
            <div><span>Lifetime value</span><strong>{{ customer.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong></div>
            <div><span>Paid orders</span><strong>{{ customer.paidOrders }}</strong></div>
            <div><span>Average order</span><strong>{{ averageOrder(customer) }}</strong></div>
            <div><span>Checkouts</span><strong>{{ customer.checkoutCount }}</strong></div>
          </section>

          <section class="info-card">
            <h3><mat-icon aria-hidden="true">local_shipping</mat-icon> Delivery address</h3>
            <p>{{ customer.street }}<br>{{ customer.city }}, {{ customer.state }}<br>{{ customer.country }}</p>
            @if (customer.note) { <blockquote>“{{ customer.note }}”</blockquote> }
          </section>

          <section class="info-card">
            <h3><mat-icon aria-hidden="true">autorenew</mat-icon> Retention</h3>
            <p>{{ reorderText(customer) }}</p>
            <p class="muted">First seen {{ customer.firstSeenAt | date:'mediumDate' }} · Last order {{ customer.lastPaidAt | date:'mediumDate' }}</p>
            @if (customer.lastOutreachAt) {
              <p class="muted">Last outreach {{ customer.lastOutreachAt | date:'mediumDate' }}{{ customer.lastOutreachChannel ? ' via ' + customer.lastOutreachChannel : '' }}</p>
            }
          </section>

          <section class="form-card">
            <h3><mat-icon aria-hidden="true">tune</mat-icon> Pipeline status</h3>
            <div class="status-grid" role="group" aria-label="Pipeline status">
              @for (option of statuses; track option) {
                <button
                  type="button"
                  class="status-option"
                  [class.is-active]="draftStatus() === option"
                  [attr.aria-pressed]="draftStatus() === option"
                  (click)="draftStatus.set(option)">{{ option }}</button>
              }
            </div>
            <h3 class="notes-title"><mat-icon aria-hidden="true">notes</mat-icon> Private notes</h3>
            <textarea rows="4" maxlength="2000" [value]="draftNotes()" (input)="draftNotes.set($any($event.target).value)" placeholder="What did you discuss? When is the next follow-up?" aria-label="Private notes"></textarea>
            <p class="notes-hint">{{ draftNotes().length }}/2000 · Only you can see these notes.</p>
          </section>
        </div>

        <footer class="detail-actions">
          @if (notice(); as message) {
            <span class="notice" role="status"><mat-icon aria-hidden="true">check_circle</mat-icon>{{ message }}</span>
          }
          <button mat-stroked-button type="button" (click)="close()">Close</button>
          <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </footer>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100dvh; }
    .detail-sheet { display: flex; flex-direction: column; height: 100dvh; width: 100%; background: var(--ms-canvas); color: var(--ms-text); }
    .detail-topbar { flex: none; display: flex; align-items: center; gap: 8px; padding: calc(8px + var(--ms-safe-top)) max(10px, calc((100vw - 640px) / 2)) 8px; border-bottom: 1px solid var(--ms-line); background: color-mix(in srgb, var(--ms-surface) 93%, transparent); backdrop-filter: blur(12px); }
    .detail-topbar > span { flex: 1; text-align: center; font-size: 0.84rem; font-weight: 700; }
    .detail-topbar button { flex: none; }
    .detail-scroll { flex: 1; display: flex; flex-direction: column; gap: 11px; padding: 13px max(13px, calc((100vw - 640px) / 2)); overflow-y: auto; overscroll-behavior: contain; }
    .profile-hero { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 17px 14px; text-align: center; border: 1px solid color-mix(in srgb, var(--ms-primary) 14%, var(--ms-line)); border-radius: 20px; background: linear-gradient(160deg, var(--ms-primary-soft), var(--ms-surface) 75%); }
    .profile-hero h2 { margin: 2px 0 0; font-size: 1.3rem; letter-spacing: -0.02em; text-transform: capitalize; }
    .avatar { width: 64px; height: 64px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 1.2rem; font-weight: 800; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .avatar--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .avatar--repeat { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .avatar--loyal { background: var(--ms-success-soft); color: var(--ms-success); }
    .avatar--dormant { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .hero-chips { display: flex; justify-content: center; flex-wrap: wrap; gap: 5px; }
    .hero-contact { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 1px; }
    .hero-contact a { display: inline-flex; align-items: center; gap: 4px; color: var(--ms-text-muted); font-size: 0.74rem; text-decoration: none; }
    .hero-contact mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .tag-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 2px; }
    .tag-row span { border-radius: 999px; padding: 2px 8px; background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.64rem; font-weight: 650; }

    .quick-contact { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 7px; }
    .quick-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 9px 4px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); font-size: 0.68rem; font-weight: 650; text-decoration: none; cursor: pointer; }
    .quick-btn:active { transform: scale(0.97); }
    .quick-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; }
    .quick-icon--call { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .quick-icon--wa { background: var(--ms-success-soft); color: var(--ms-success); }
    .quick-icon--sms { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .quick-icon--mail { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .consent-note { display: flex; align-items: flex-start; gap: 6px; padding: 9px 11px; border-radius: 12px; background: var(--ms-warning-soft); color: var(--ms-warning); font-size: 0.72rem; line-height: 1.45; }
    .consent-note mat-icon { flex: none; margin-top: 1px; font-size: 16px; width: 16px; height: 16px; }
    .consent-chip { display: inline-flex; align-items: center; gap: 3px; border-radius: 999px; padding: 3px 8px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.65rem; font-weight: 700; white-space: nowrap; }
    .consent-chip mat-icon { font-size: 12px; width: 12px; height: 12px; }

    .detail-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .detail-stats > div { display: flex; flex-direction: column; gap: 2px; padding: 10px 11px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .detail-stats span { color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
    .detail-stats strong { font-family: var(--ms-font-display); font-size: 1.08rem; font-variant-numeric: tabular-nums; }

    .info-card, .form-card { padding: 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--ms-surface); }
    .info-card h3, .form-card h3 { display: flex; align-items: center; gap: 5px; margin: 0 0 6px; color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .info-card h3 mat-icon, .form-card h3 mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .info-card p { margin: 0 0 4px; font-size: 0.82rem; line-height: 1.55; }
    .info-card p:last-child { margin-bottom: 0; }
    .info-card .muted { color: var(--ms-text-muted); font-size: 0.73rem; }
    .info-card blockquote { margin: 7px 0 0; padding: 7px 9px; border-left: 3px solid var(--ms-primary); border-radius: 0 8px 8px 0; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.5; }
    .notes-title { margin-top: 13px !important; }
    .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 5px; }
    .status-option { min-height: 40px; padding: 5px 7px; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-surface-2); color: var(--ms-text); font: inherit; font-size: 0.73rem; font-weight: 650; cursor: pointer; }
    .status-option.is-active { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); }
    textarea { width: 100%; min-height: 94px; resize: vertical; padding: 9px 10px; border: 1px solid var(--ms-line); border-radius: 12px; outline: none; background: var(--ms-surface-2); color: var(--ms-text); font: inherit; font-size: 0.82rem; line-height: 1.5; }
    textarea:focus { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 16%, transparent); }
    .notes-hint { margin: 4px 0 0; color: var(--ms-text-muted); font-size: 0.66rem; }

    .detail-actions { flex: none; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 9px max(13px, calc((100vw - 640px) / 2)) calc(9px + var(--ms-safe-bottom)); border-top: 1px solid var(--ms-line); background: color-mix(in srgb, var(--ms-surface) 95%, transparent); backdrop-filter: blur(12px); }
    .notice { flex: 1 1 100%; display: inline-flex; align-items: center; gap: 4px; color: var(--ms-success); font-size: 0.73rem; }
    .notice mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .detail-actions button { min-height: 46px; }
    .detail-actions button[mat-flat-button] { flex: 1; }

    .segment-pill, .state-chip { display: inline-flex; align-items: center; gap: 3px; border-radius: 999px; padding: 3px 8px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; }
    .segment-pill { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .segment-pill--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .segment-pill--repeat { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .segment-pill--loyal { background: var(--ms-success-soft); color: var(--ms-success); }
    .segment-pill--dormant { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .state-chip { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .state-chip--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .state-chip--contacted, .state-chip--qualified { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .state-chip--converted { background: var(--ms-success-soft); color: var(--ms-success); }
    .state-chip--closed { background: var(--ms-canvas); color: var(--ms-text-muted); }

    @media (min-width: 480px) {
      .detail-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  `],
})
export class CustomerDetailSheetComponent {
  private readonly facade = inject(CustomerLeadsFacade);
  private readonly dialogRef = inject(MatDialogRef<CustomerDetailSheetComponent>);

  protected readonly selected = this.facade.selected;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly notice = this.facade.notice;
  protected readonly statuses = this.facade.statuses;
  protected readonly draftStatus = this.facade.draftStatus;
  protected readonly draftNotes = this.facade.draftNotes;

  protected load(): void { this.facade.load(); }
  protected save(): void { this.facade.save(); }
  protected initial(row: StoreCustomerLead): string { return this.facade.initial(row); }
  protected segmentFor(row: StoreCustomerLead) { return this.facade.segmentFor(row); }
  protected averageOrder(row: StoreCustomerLead): string { return this.facade.averageOrder(row); }
  protected reorderText(row: StoreCustomerLead): string { return this.facade.reorderText(row); }
  protected reorderMessage(row: StoreCustomerLead): string { return this.facade.reorderMessage(row); }
  protected whatsapp(phone: string, name = '', message = ''): string { return this.facade.whatsapp(phone, name, message); }
  protected email(row: StoreCustomerLead, message = ''): string { return this.facade.email(row, message); }
  protected recordOutreach(row: StoreCustomerLead, channel: 'whatsapp' | 'email' | 'call'): void {
    this.facade.recordOutreach(row, channel);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
