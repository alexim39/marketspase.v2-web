import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoreService } from '../../../../core/store/store.service';
import { StoreCustomerLead } from '../../../../core/store/store.models';
import { ApiError, userError } from '../../../../core/http/api-error';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Closed'] as const;

/**
 * Customer Leads — the partner's CRM view of people who reached checkout
 * in their store. Separate from the prospect pipeline: these are buyers,
 * not cold prospects. Checkout contact data is captured automatically.
 */
@Component({
  selector: 'async-customer-leads',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSelectModule, RouterModule, PageSkeletonComponent,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Pipeline</a> &gt;
        <span>Customers</span>
      </div>
    </section>

    <section class="leads-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Pipeline · Customer retention</p>
          <h1>Customers who buy from you</h1>
          <p class="subtitle">
            These are buyers, not cold prospects. Track repeat orders, spot customers who have gone quiet and follow up only where they opted in.
          </p>
        </div>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/dashboard/products/my-store"><mat-icon>storefront</mat-icon> My store</a>
          <a mat-flat-button color="primary" routerLink="/dashboard/products/store-orders"><mat-icon>receipt_long</mat-icon> Store orders</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="customer retention" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="load()">Retry</button></div>
      }

      @if (summary(); as s) {
        <section class="kpi-grid" aria-label="Customer summary">
          <div class="kpi"><span class="kpi-icon"><mat-icon>groups</mat-icon></span><div><strong>{{ s.totalLeads }}</strong><span>Customers captured</span></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--ok"><mat-icon>repeat</mat-icon></span><div><strong>{{ s.repeatCustomers }}</strong><span>Repeat customers</span></div></div>
          <div class="kpi"><span class="kpi-icon kpi-icon--info"><mat-icon>payments</mat-icon></span><div><strong>{{ s.revenue | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong><span>Lifetime value</span></div></div>
          <div class="kpi" [class.kpi--attention]="(s.segments?.dormant ?? 0) > 0">
            <span class="kpi-icon kpi-icon--warn"><mat-icon>schedule</mat-icon></span>
            <div><strong>{{ s.segments?.dormant ?? 0 }}</strong><span>Reorder due</span></div>
          </div>
        </section>
      }

      @if ((summary()?.segments?.dormant ?? 0) > 0) {
        <div class="retention-banner" role="status">
          <mat-icon>notifications_active</mat-icon>
          <div>
            <strong>{{ summary()?.segments?.dormant }} customer{{ summary()?.segments?.dormant === 1 ? '' : 's' }} have not ordered in 60+ days</strong>
            <p>A short, consent-based check-in can bring them back. Start with the reorder-due list.</p>
          </div>
          <button mat-stroked-button type="button" (click)="setSegment('dormant')">Review reorder due</button>
        </div>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-label>Search name, phone, email or city</mat-label>
          <input matInput [value]="query()" (input)="onSearch($any($event.target).value)" maxlength="80" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="status-filter">
          <mat-label>Status</mat-label>
          <mat-select [value]="status()" (valueChange)="setStatus($event)">
            <mat-option value="">All statuses</mat-option>
            @for (option of statuses; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()"><mat-icon>refresh</mat-icon> Refresh</button>
      </div>

      <div class="segment-row" role="tablist" aria-label="Customer segment">
        <button type="button" class="segment-btn" [class.segment-btn--active]="segment() === 'all'" (click)="setSegment('all')">All <span>{{ summary()?.totalLeads ?? total() }}</span></button>
        <button type="button" class="segment-btn" [class.segment-btn--active]="segment() === 'new'" (click)="setSegment('new')">New <span>{{ summary()?.segments?.new ?? 0 }}</span></button>
        <button type="button" class="segment-btn" [class.segment-btn--active]="segment() === 'repeat'" (click)="setSegment('repeat')">Repeat <span>{{ summary()?.segments?.repeat ?? 0 }}</span></button>
        <button type="button" class="segment-btn" [class.segment-btn--active]="segment() === 'loyal'" (click)="setSegment('loyal')">Loyal <span>{{ summary()?.segments?.loyal ?? 0 }}</span></button>
        <button type="button" class="segment-btn" [class.segment-btn--active]="segment() === 'dormant'" (click)="setSegment('dormant')">Reorder due <span>{{ summary()?.segments?.dormant ?? 0 }}</span></button>
      </div>

      @if (!loading() && rows().length === 0) {
        <div class="empty-card">
          <mat-icon>person_add</mat-icon>
          <h3>{{ segment() === 'all' ? 'No customer leads yet' : 'No customers in this segment' }}</h3>
          <p>{{ segment() === 'all' ? 'Customer details appear here automatically when someone reaches checkout in your store. Share your store link to get the first one.' : 'Try another segment or clear the filters to see the rest of your customers.' }}</p>
          @if (segment() === 'all') {
            <a mat-flat-button color="primary" routerLink="/dashboard/products/my-store">Open my store</a>
          } @else {
            <button mat-stroked-button type="button" (click)="setSegment('all')">Show all customers</button>
          }
        </div>
      } @else if (rows().length > 0) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Segment</th>
                <th>Orders</th>
                <th>Lifetime value</th>
                <th>Last order</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr [class.selected]="selected()?.id === row.id">
                  <td data-label="Customer">
                    <div class="customer-cell">
                      <span class="avatar">{{ initial(row) }}</span>
                      <div>
                        <strong>{{ row.name || 'Customer' }}</strong>
                        <span class="muted">{{ row.email }}</span>
                        <span class="muted">{{ row.phone }}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Segment">
                    <span [class]="'segment-pill segment-pill--' + segmentFor(row).tone">{{ segmentFor(row).label }}</span>
                    @if (isReorderDue(row)) { <span class="reorder-tag">Reorder due</span> }
                  </td>
                  <td data-label="Orders">
                    <strong>{{ row.paidOrders }}</strong>
                    <span class="muted">{{ row.checkoutCount }} checkouts</span>
                  </td>
                  <td data-label="Lifetime value"><strong>{{ row.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong></td>
                  <td data-label="Last order">
                    <strong>{{ row.lastPaidAt | date:'mediumDate' }}</strong>
                    @if (row.consentToContact) { <span class="consent">Opted in</span> }
                  </td>
                  <td data-label="Status"><span class="status" [class]="'status status-' + row.status.toLowerCase()">{{ row.status }}</span></td>
                  <td data-label="Actions" class="actions">
                    <button mat-icon-button type="button" (click)="select(row)" aria-label="Open customer"><mat-icon>open_in_new</mat-icon></button>
                    @if (row.consentToContact && row.phone) {
                      <a mat-icon-button [href]="whatsapp(row.phone, row.name)" target="_blank" rel="noopener" aria-label="WhatsApp customer" (click)="recordOutreach(row, 'whatsapp')"><mat-icon>chat</mat-icon></a>
                    }
                    @if (row.phone) {
                      <a mat-icon-button [href]="'tel:' + row.phone" aria-label="Call customer" (click)="recordOutreach(row, 'call')"><mat-icon>call</mat-icon></a>
                    }
                    @if (row.email) {
                      <a mat-icon-button [href]="email(row)" aria-label="Email customer" (click)="recordOutreach(row, 'email')"><mat-icon>mail</mat-icon></a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pager">
          <span class="muted">Showing {{ rows().length }} of {{ total() }}</span>
          <div>
            <button mat-stroked-button type="button" [disabled]="pageIndex() === 0 || loading()" (click)="prevPage()">Previous</button>
            <button mat-stroked-button type="button" [disabled]="pageIndex() + pageSize >= total() || loading()" (click)="nextPage()">Next</button>
          </div>
        </div>
      }

      @if (selected(); as customer) {
        <section class="detail">
          <div class="detail-head">
            <div class="customer-cell">
              <span class="avatar large">{{ initial(customer) }}</span>
              <div>
                <h3>{{ customer.name || 'Customer' }}</h3>
                <span class="muted">{{ customer.email }} · {{ customer.phone }}</span>
                <span [class]="'segment-pill segment-pill--' + segmentFor(customer).tone">{{ segmentFor(customer).label }}</span>
              </div>
            </div>
            <button mat-icon-button type="button" (click)="selected.set(null)" aria-label="Close customer"><mat-icon>close</mat-icon></button>
          </div>

          <div class="detail-grid">
            <div><h4>Delivery address</h4><p>{{ customer.street }}<br>{{ customer.city }}, {{ customer.state }}<br>{{ customer.country }}</p>@if (customer.note) { <p class="muted">Checkout note: “{{ customer.note }}”</p> }</div>
            <div><h4>Customer value</h4><p><strong>{{ customer.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong> lifetime</p><p class="muted">{{ customer.paidOrders }} paid · {{ customer.checkoutCount }} checkouts · {{ customer.refundedOrders }} refunds</p><p class="muted">Average order {{ averageOrder(customer) }}</p></div>
            <div><h4>Retention</h4><p>Last order {{ customer.lastPaidAt | date:'mediumDate' }}</p><p class="muted">{{ reorderText(customer) }}</p><p class="muted">First seen {{ customer.firstSeenAt | date:'mediumDate' }}</p></div>
            <div><h4>Consent</h4><p><span class="status" [class]="'status ' + (customer.consentToContact ? 'status-converted' : 'status-closed')">{{ customer.consentToContact ? 'Opted in to updates' : 'Order contact only' }}</span></p><p class="muted">Only contact customers who opted in, and keep every message relevant.</p></div>
          </div>

          <div class="outreach-row">
            @if (customer.consentToContact && customer.phone) {
              <a mat-stroked-button [href]="whatsapp(customer.phone, customer.name, reorderMessage(customer))" target="_blank" rel="noopener" (click)="recordOutreach(customer, 'whatsapp')"><mat-icon>chat</mat-icon> WhatsApp check-in</a>
            }
            @if (customer.email) {
              <a mat-stroked-button [href]="email(customer, reorderMessage(customer))" (click)="recordOutreach(customer, 'email')"><mat-icon>mail</mat-icon> Email check-in</a>
            }
            @if (customer.phone) {
              <a mat-stroked-button [href]="'tel:' + customer.phone" (click)="recordOutreach(customer, 'call')"><mat-icon>call</mat-icon> Call</a>
            }
            @if (!customer.consentToContact) {
              <span class="consent-note"><mat-icon>info</mat-icon> Outreach is limited to their order contact preference.</span>
            }
          </div>

          <div class="detail-form">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Pipeline status</mat-label>
              <mat-select [value]="draftStatus()" (valueChange)="draftStatus.set($event)">
                @for (option of statuses; track option) { <mat-option [value]="option">{{ option }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="notes">
              <mat-label>Private notes</mat-label>
              <textarea matInput rows="3" maxlength="2000" [value]="draftNotes()" (input)="draftNotes.set($any($event.target).value)" placeholder="What did you discuss? When is the next follow-up?"></textarea>
            </mat-form-field>
          </div>
          <div class="detail-actions">
            @if (notice(); as message) { <span class="notice">{{ message }}</span> }
            <button mat-stroked-button type="button" (click)="selected.set(null)">Cancel</button>
            <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save customer' }}</button>
          </div>
        </section>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .leads-page { display: flex; flex-direction: column; gap: 16px; max-width: 1200px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 62em; line-height: 1.6; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 6px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .kpi { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .kpi--attention { background: var(--ms-warning-soft); }
    .kpi-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kpi-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .kpi-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .kpi-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kpi-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .kpi div { display: flex; flex-direction: column; gap: 1px; }
    .kpi strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .kpi span:last-child { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .retention-banner { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-warning-soft); border: 1px solid var(--ms-warning); color: var(--ms-warning); }
    .retention-banner > div { flex: 1; min-width: 240px; }
    .retention-banner strong { display: block; font-size: 0.875rem; }
    .retention-banner p { margin: 2px 0 0; font-size: 0.8125rem; line-height: 1.5; }
    .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .toolbar .search { flex: 1 1 280px; }
    .toolbar .status-filter { flex: 0 1 180px; }
    .toolbar > button mat-icon { margin-right: 4px; }
    .segment-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .segment-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text); font: inherit; font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
    .segment-btn:hover { border-color: var(--ms-primary); }
    .segment-btn span { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; }
    .segment-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .segment-btn--active span { background: var(--ms-surface); color: var(--ms-primary-strong); }
    .table-wrap { overflow-x: auto; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--ms-line); vertical-align: middle; }
    th { color: var(--ms-text-muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr.selected { background: var(--ms-primary-soft); }
    .customer-cell { display: flex; align-items: center; gap: 12px; }
    .customer-cell div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .customer-cell strong { text-transform: capitalize; }
    .avatar { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .avatar.large { width: 48px; height: 48px; }
    .muted { color: var(--ms-text-muted); font-size: 0.8125rem; }
    .status, .segment-pill { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
    .status { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .status-new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .status-contacted, .status-qualified { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .status-converted { background: var(--ms-success-soft); color: var(--ms-success); }
    .status-closed { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .segment-pill { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .segment-pill--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .segment-pill--repeat { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .segment-pill--loyal { background: var(--ms-success-soft); color: var(--ms-success); }
    .segment-pill--dormant { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .reorder-tag { display: block; margin-top: 4px; color: var(--ms-warning); font-size: 0.6875rem; font-weight: 700; }
    .consent { display: block; color: var(--ms-success); font-size: 0.6875rem; font-weight: 700; }
    .actions { white-space: nowrap; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .pager button { min-height: 40px; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 48px 24px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.65; }
    .empty-card h3 { margin: 0; color: var(--ms-text); }
    .empty-card p { margin: 0; max-width: 44em; line-height: 1.6; }
    .detail { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .detail-head h3 { margin: 0; text-transform: capitalize; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .detail-grid h4 { margin: 0 0 6px; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
    .detail-grid p { margin: 0 0 4px; line-height: 1.55; }
    .outreach-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px 16px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .outreach-row button, .outreach-row a { min-height: 40px; }
    .outreach-row mat-icon { margin-right: 4px; }
    .consent-note { display: inline-flex; align-items: center; gap: 4px; color: var(--ms-text-muted); font-size: 0.75rem; }
    .detail-form { display: grid; grid-template-columns: minmax(160px, 220px) minmax(0, 1fr); gap: 12px; }
    .detail-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .notice { color: var(--ms-success); font-size: 0.8125rem; margin-right: auto; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    button { min-height: 40px; }
    @media (max-width: 1000px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) {
      .table-wrap { background: transparent; border: 0; overflow: visible; }
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tbody { display: flex; flex-direction: column; gap: 12px; }
      tbody tr { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 8px 16px; }
      td { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--ms-line); padding: 8px 0; }
      td:last-child { border-bottom: none; }
      td::before { content: attr(data-label); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .customer-cell { align-items: flex-start; }
      .actions { justify-content: flex-end; }
      .detail { padding: 16px; }
      .detail-form { grid-template-columns: minmax(0, 1fr); }
      .kpi-grid { grid-template-columns: minmax(0, 1fr); }
    }
`],
})
export class CustomerLeadsComponent implements OnInit {
  private readonly store = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = STATUSES;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<StoreCustomerLead[]>([]);
  protected readonly total = signal(0);
  protected readonly summary = signal<{
    totalLeads: number; repeatCustomers: number; paidOrders: number; revenue: number; newThisMonth: number;
    segments?: { new: number; repeat: number; dormant: number; loyal: number };
  } | null>(null);
  protected readonly query = signal('');
  protected readonly status = signal('');
  protected readonly segment = signal<'all' | 'new' | 'repeat' | 'dormant' | 'loyal'>('all');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = 50;
  protected readonly selected = signal<StoreCustomerLead | null>(null);
  protected readonly draftStatus = signal<StoreCustomerLead['status']>('New');
  protected readonly draftNotes = signal('');
  protected readonly hasNext = computed(() => this.pageIndex() + this.pageSize < this.total());

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.store.customerLeads({
      q: this.query().trim(),
      status: this.status() || undefined,
      segment: this.segment(),
      limit: this.pageSize,
      skip: this.pageIndex() * this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.summary.set(res.meta?.summary ?? null);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
      },
    });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  protected setSegment(value: 'all' | 'new' | 'repeat' | 'dormant' | 'loyal'): void {
    this.segment.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  protected prevPage(): void {
    if (this.pageIndex() === 0) return;
    this.pageIndex.update((p) => Math.max(0, p - 1));
    this.load();
  }

  protected nextPage(): void {
    if (!this.hasNext()) return;
    this.pageIndex.update((p) => p + 1);
    this.load();
  }

  protected select(row: StoreCustomerLead): void {
    this.selected.set(row);
    this.draftStatus.set(row.status);
    this.draftNotes.set(row.partnerNotes ?? '');
    this.notice.set(null);
  }

  protected save(): void {
    const customer = this.selected();
    if (!customer || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.store.updateCustomerLead(customer.id, {
      status: this.draftStatus(),
      partnerNotes: this.draftNotes(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notice.set('Customer updated.');
        const fresh = res.data;
        this.rows.update((rows) => rows.map((row) => (row.id === fresh.id ? fresh : row)));
        this.selected.set(fresh);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.error.set(userError(err));
      },
    });
  }

  protected initial(row: StoreCustomerLead): string {
    return String(row.name || row.email || 'C').trim().charAt(0).toUpperCase();
  }

  protected recordOutreach(row: StoreCustomerLead, channel: 'whatsapp' | 'email' | 'call'): void {
    this.store.recordCustomerOutreach(row.id, channel)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const fresh = res.data;
          this.rows.update((rows) => rows.map((item) => (item.id === fresh.id ? fresh : item)));
          if (this.selected()?.id === fresh.id) this.selected.set(fresh);
        },
        error: () => { /* outreach still opens; tracking is best-effort */ },
      });
  }

  protected segmentFor(row: StoreCustomerLead): { label: string; tone: 'new' | 'repeat' | 'loyal' | 'dormant' } {
    if (this.isReorderDue(row)) return { label: 'Reorder due', tone: 'dormant' };
    if (row.paidOrders >= 3) return { label: 'Loyal', tone: 'loyal' };
    if (row.paidOrders >= 2) return { label: 'Repeat', tone: 'repeat' };
    if (row.paidOrders >= 1) return { label: 'Customer', tone: 'new' };
    return { label: 'New lead', tone: 'new' };
  }

  protected isReorderDue(row: StoreCustomerLead): boolean {
    if (!row.lastPaidAt || row.paidOrders < 1) return false;
    const last = new Date(row.lastPaidAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last >= 60 * 86400000;
  }

  protected averageOrder(row: StoreCustomerLead): string {
    if (!row.paidOrders) return '—';
    return `₦${(row.totalSpent / row.paidOrders).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }

  protected reorderText(row: StoreCustomerLead): string {
    if (!row.lastPaidAt) return 'No paid order yet — keep the first conversation warm.';
    const last = new Date(row.lastPaidAt).getTime();
    if (Number.isNaN(last)) return 'Last order date unavailable.';
    const days = Math.floor((Date.now() - last) / 86400000);
    if (this.isReorderDue(row)) return `Reorder due — last order was ${days} day${days === 1 ? '' : 's'} ago.`;
    const next = new Date(last + 60 * 86400000);
    return `Next reorder check-in after ${next.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}.`;
  }

  protected reorderMessage(row: StoreCustomerLead): string {
    const first = String(row.name || 'there').trim().split(/\s+/)[0] || 'there';
    return `Hi ${first}, it has been a while since your last order. Would you like me to help you restock or recommend something that fits what you bought before?`;
  }

  protected whatsapp(phone: string, name = '', message = ''): string {
    const digits = String(phone ?? '').replace(/\D/g, '').replace(/^0/, '234');
    const text = message || `Hi ${String(name || 'there').trim().split(/\s+/)[0] || 'there'}, just checking in. How can I help with your next order?`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  protected email(row: StoreCustomerLead, message = ''): string {
    const subject = encodeURIComponent('Checking in from MarketSpase');
    const body = encodeURIComponent(message || `Hi ${String(row.name || 'there').trim().split(/\s+/)[0] || 'there'}, just checking in. How can I help with your next order?`);
    return `mailto:${row.email}?subject=${subject}&body=${body}`;
  }
}
