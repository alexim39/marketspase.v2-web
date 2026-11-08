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
        <span>Customer leads</span>
      </div>
    </section>

    <section class="leads-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Store customers</p>
          <h2>Customer leads</h2>
          <p class="subtitle">
            Everyone who checked out in your store, with the contact and delivery details they entered.
            Follow up, tag your progress and turn a first order into a repeat customer.
          </p>
        </div>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/dashboard/products/my-store"><mat-icon>storefront</mat-icon> My store</a>
          <a mat-flat-button color="primary" routerLink="/dashboard/products/store-orders"><mat-icon>receipt_long</mat-icon> Store orders</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="customer leads" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      @if (summary(); as s) {
        <div class="kpi-grid">
          <div class="dp-card kpi"><mat-icon>groups</mat-icon><strong>{{ s.totalLeads }}</strong><span>customers captured</span></div>
          <div class="dp-card kpi"><mat-icon>workspace_premium</mat-icon><strong>{{ s.repeatCustomers }}</strong><span>repeat customers</span></div>
          <div class="dp-card kpi"><mat-icon>payments</mat-icon><strong>{{ s.revenue | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong><span>lifetime value</span></div>
          <div class="dp-card kpi"><mat-icon>fiber_new</mat-icon><strong>{{ s.newThisMonth }}</strong><span>new this month</span></div>
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
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (!loading() && rows().length === 0) {
        <div class="empty-card">
          <mat-icon>person_add</mat-icon>
          <h3>No customer leads yet</h3>
          <p>Customer details appear here automatically when someone reaches checkout in your store. Share your store link to get the first one.</p>
          <a mat-flat-button color="primary" routerLink="/dashboard/products/my-store">Open my store</a>
        </div>
      } @else if (rows().length > 0) {
        <div class="table-wrap dp-card">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Value</th>
                <th>Last checkout</th>
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
                  <td data-label="Location">
                    <strong>{{ row.city || '—' }}</strong>
                    <span class="muted">{{ row.state || '' }}</span>
                  </td>
                  <td data-label="Orders">
                    <strong>{{ row.paidOrders }}</strong>
                    <span class="muted">{{ row.checkoutCount }} checkouts</span>
                  </td>
                  <td data-label="Value"><strong>{{ row.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong></td>
                  <td data-label="Last checkout">
                    <strong>{{ row.lastCheckoutAt | date:'mediumDate' }}</strong>
                    @if (row.consentToContact) { <span class="consent">Opted in</span> }
                  </td>
                  <td data-label="Status"><span class="status" [class]="'status status-' + row.status.toLowerCase()">{{ row.status }}</span></td>
                  <td data-label="Actions" class="actions">
                    <button mat-icon-button type="button" (click)="select(row)" aria-label="Open customer"><mat-icon>open_in_new</mat-icon></button>
                    @if (row.phone) {
                      <a mat-icon-button [href]="'tel:' + row.phone" aria-label="Call customer"><mat-icon>call</mat-icon></a>
                      <a mat-icon-button [href]="whatsapp(row.phone)" target="_blank" rel="noopener" aria-label="WhatsApp customer"><mat-icon>chat</mat-icon></a>
                    }
                    @if (row.email) {
                      <a mat-icon-button [href]="'mailto:' + row.email" aria-label="Email customer"><mat-icon>mail</mat-icon></a>
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
            <button mat-button type="button" [disabled]="pageIndex() === 0 || loading()" (click)="prevPage()">Previous</button>
            <button mat-button type="button" [disabled]="pageIndex() + pageSize >= total() || loading()" (click)="nextPage()">Next</button>
          </div>
        </div>
      }

      @if (selected(); as customer) {
        <div class="detail dp-card">
          <div class="detail-head">
            <div class="customer-cell">
              <span class="avatar large">{{ initial(customer) }}</span>
              <div>
                <h3>{{ customer.name || 'Customer' }}</h3>
                <span class="muted">{{ customer.email }} · {{ customer.phone }}</span>
              </div>
            </div>
            <button mat-icon-button type="button" (click)="selected.set(null)" aria-label="Close customer"><mat-icon>close</mat-icon></button>
          </div>

          <div class="detail-grid">
            <div>
              <h4>Delivery address</h4>
              <p>{{ customer.street }}<br>{{ customer.city }}, {{ customer.state }}<br>{{ customer.country }}</p>
              @if (customer.note) { <p class="muted">Checkout note: “{{ customer.note }}”</p> }
            </div>
            <div>
              <h4>Customer value</h4>
              <p><strong>{{ customer.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong> lifetime</p>
              <p class="muted">{{ customer.paidOrders }} paid · {{ customer.checkoutCount }} checkouts · {{ customer.refundedOrders }} refunds</p>
              <p class="muted">First seen {{ customer.firstSeenAt | date:'mediumDate' }}</p>
            </div>
            <div>
              <h4>Consent</h4>
              <p>
                <span class="status" [class]="'status ' + (customer.consentToContact ? 'status-converted' : 'status-closed')">
                  {{ customer.consentToContact ? 'Opted in to updates' : 'Order contact only' }}
                </span>
              </p>
            </div>
          </div>

          <div class="detail-form">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Pipeline status</mat-label>
              <mat-select [value]="draftStatus()" (valueChange)="draftStatus.set($event)">
                @for (option of statuses; track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
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
            <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Saving…' : 'Save customer' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .leads-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; gap: 1em; align-items: flex-start; flex-wrap: wrap; }
    .page-head h2 { margin: 0.1em 0 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0.35em 0 0; color: var(--ms-text-muted); max-width: 52em; line-height: 1.55; }
    .head-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 0.25em; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75em; }
    .kpi { display: flex; flex-direction: column; gap: 0.15em; padding: 1em; }
    .kpi mat-icon { color: var(--ms-primary-strong); }
    .kpi strong { font-size: 1.4em; font-variant-numeric: tabular-nums; }
    .kpi span { color: var(--ms-text-muted); font-size: 0.8em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar .search { flex: 1 1 280px; }
    .toolbar .status-filter { flex: 0 1 180px; }
    .table-wrap { overflow-x: auto; padding: 0.25em 0.75em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75em 0.55em; border-bottom: 1px solid var(--ms-line); vertical-align: middle; }
    th { color: var(--ms-text-muted); font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.06em; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr.selected { background: var(--ms-primary-soft); }
    .customer-cell { display: flex; align-items: center; gap: 0.65em; }
    .customer-cell div { display: flex; flex-direction: column; gap: 0.05em; min-width: 0; }
    .customer-cell strong { text-transform: capitalize; }
    .avatar { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .avatar.large { width: 44px; height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.82em; }
    .status { display: inline-block; border-radius: 999px; padding: 3px 9px; font-size: 0.72em; font-weight: 700; background: var(--ms-surface-3); color: var(--ms-text); white-space: nowrap; }
    .status-new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .status-contacted, .status-qualified { background: var(--ms-warning-soft, var(--ms-primary-soft)); color: var(--ms-warning, var(--ms-primary-strong)); }
    .status-converted { background: var(--ms-success-soft); color: var(--ms-success); }
    .status-closed { background: var(--ms-surface-3); color: var(--ms-text-muted); }
    .consent { display: block; color: var(--ms-success); font-size: 0.75em; font-weight: 700; }
    .actions { white-space: nowrap; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 1em; flex-wrap: wrap; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.65em; text-align: center; padding: 2.6em 1.5em; border: 1px dashed var(--ms-line); border-radius: 14px; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 44px; width: 44px; height: 44px; opacity: 0.6; }
    .empty-card h3 { margin: 0; color: var(--ms-text); }
    .empty-card p { margin: 0; max-width: 38em; }
    .detail { padding: 1.1em; display: flex; flex-direction: column; gap: 1em; }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; }
    .detail-head h3 { margin: 0; text-transform: capitalize; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; }
    .detail-grid h4 { margin: 0 0 0.35em; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
    .detail-grid p { margin: 0 0 0.3em; line-height: 1.55; }
    .detail-form { display: grid; grid-template-columns: minmax(160px, 220px) minmax(0, 1fr); gap: 0.8em; }
    .detail-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .notice { color: var(--ms-success); font-size: 0.85em; margin-right: auto; }
    .error { color: var(--ms-error); }
    button { min-height: 40px; }
    @media (max-width: 760px) {
      .table-wrap { overflow: visible; padding: 0; background: transparent; }
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tbody { display: flex; flex-direction: column; gap: 0.75em; }
      tbody tr { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 12px; padding: 0.35em 0.7em; }
      td { display: flex; justify-content: space-between; gap: 0.8em; border-bottom: 1px solid var(--ms-line); padding: 0.55em 0; }
      td:last-child { border-bottom: none; }
      td::before { content: attr(data-label); color: var(--ms-text-muted); font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .customer-cell { align-items: flex-start; }
      .actions { justify-content: flex-end; }
      .detail-form { grid-template-columns: 1fr; }
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
  } | null>(null);
  protected readonly query = signal('');
  protected readonly status = signal('');
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

  protected whatsapp(phone: string): string {
    const digits = String(phone ?? '').replace(/\D/g, '').replace(/^0/, '234');
    return `https://wa.me/${digits}`;
  }
}
