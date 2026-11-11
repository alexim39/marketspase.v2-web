import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminProductsService, AdminProduct } from './admin-products.service';
import { AdminProductWizardComponent } from './product-wizard.component';
import { ApiError } from '../../../core/http/api-error';

/**
 * Admin product catalog + launch wizard.
 *
 * The wizard owns create/edit, costs, media and the profitability gate.
 * This component is the list, status overview and entry point.
 */
@Component({
  selector: 'async-admin-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    RouterModule,
    AdminProductWizardComponent,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Products</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Catalog</p>
          <h2>Products</h2>
          <p class="subtitle">
            Upload products with real landed costs, 1–5 images or videos, and a server-checked
            margin. Loss-making products cannot be published.
          </p>
        </div>
        @if (!wizardOpen()) {
          <button mat-flat-button color="primary" type="button" (click)="openNew()">
            <mat-icon>add</mat-icon> New product
          </button>
        }
      </div>

      @if (!wizardOpen()) {
        @if (notice(); as note) {
          <p class="notice" role="status"><mat-icon>check_circle</mat-icon>{{ note }}</p>
        }

        @if (loading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading products" />
        }

        @if (error(); as err) {
          <p class="error" role="alert">
            <mat-icon>error_outline</mat-icon>
            {{ err }}
            <button mat-button type="button" (click)="reload()">Retry</button>
          </p>
        }

        <div class="stats">
          <div><span>Total products</span><strong>{{ rows().length }}</strong></div>
          <div><span>Published</span><strong>{{ activeCount() }}</strong></div>
          <div><span>Drafts</span><strong>{{ draftCount() }}</strong></div>
          <div><span>Blocked pricing</span><strong>{{ blockedCount() }}</strong></div>
        </div>

        @if (rows().length > 0) {
          <div class="table-wrap">
            <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Product</th>
                <td mat-cell *matCellDef="let row">
                  <div class="product-cell">
                    <span class="product-thumb">
                      @if (cover(row); as image) {
                        <img [src]="image" [alt]="row.name" loading="lazy" />
                      } @else {
                        <mat-icon>inventory_2</mat-icon>
                      }
                    </span>
                    <span>
                      <strong>{{ row.name ?? '—' }}</strong>
                      <small>{{ row.category || 'Essentials' }} · {{ row.media?.length || legacyMediaCount(row) }} media</small>
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="price">
                <th mat-header-cell *matHeaderCellDef>Prices</th>
                <td mat-cell *matCellDef="let row">
                  <div class="price-cell">
                    <span>Direct <strong>{{ money(row.price) }}</strong></span>
                    <span>Partner <strong>{{ money(row.partnerPrice) }}</strong></span>
                    <span>Retail <strong>{{ money(row.retailPrice) }}</strong></span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="margin">
                <th mat-header-cell *matHeaderCellDef>Platform contribution</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.pricing; as pricing) {
                    <span class="margin" [class.bad]="pricing.status === 'blocked' || pricing.status === 'incomplete'">
                      {{ pricing.platformContribution | number:'1.0-0' }}
                      <small>{{ (pricing.platformContributionPct * 100) | number:'1.1-1' }}%</small>
                    </span>
                  } @else {
                    <span class="muted">Not calculated</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="stock">
                <th mat-header-cell *matHeaderCellDef>Stock</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.stock === null || row.stock === undefined) {
                    <span class="muted">Unlimited</span>
                  } @else {
                    <span [class.low-stock]="row.stock <= 5">{{ row.stock }}</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="commission">
                <th mat-header-cell *matHeaderCellDef>Commission</th>
                <td mat-cell *matCellDef="let row">
                  <span class="dp-status" [class.dp-status--ok]="row.commissionable" [class.dp-status--neutral]="!row.commissionable">
                    {{ row.commissionable ? 'On' : 'Off' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'status-chip status-chip--' + (row.status ?? 'active')">{{ row.status ?? 'active' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="action">
                <th mat-header-cell *matHeaderCellDef>Action</th>
                <td mat-cell *matCellDef="let row">
                  <div class="row-actions">
                    <button mat-button type="button" (click)="openEdit(row)">Edit</button>
                    @if (row.status === 'draft') {
                      <button mat-button type="button" color="primary" [disabled]="!row.pricing?.canPublish || (!row.media?.length && legacyMediaCount(row) === 0)" (click)="publish(row)">
                        Publish
                      </button>
                    }
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        } @else if (!loading() && !error()) {
          <div class="state-card">
            <mat-icon>inventory_2</mat-icon>
            <h3>No products yet</h3>
            <p>Start with one product and capture its true landed cost before publishing.</p>
            <button mat-flat-button color="primary" type="button" (click)="openNew()">Create first product</button>
          </div>
        }
      } @else {
        <async-admin-product-wizard
          [product]="editingProduct()"
          (saved)="onSaved($event)"
          (cancelled)="closeWizard()"
        />
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .page-head h2 { margin: 2px 0 4px; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: .68rem; font-weight: 700; color: var(--ms-primary-strong); }
    .subtitle { margin: .25em 0 0; color: var(--ms-text-muted); max-width: 52em; line-height: 1.5; }
    .notice, .error { display: flex; gap: 8px; align-items: center; margin: 0; }
    .notice { color: var(--ms-success, #157347); }
    .error { color: var(--ms-error, #b42318); }
    .notice mat-icon, .error mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .stats > div { border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface); padding: 12px 14px; }
    .stats span { display: block; color: var(--ms-text-muted); font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; }
    .stats strong { display: block; margin-top: 3px; font-size: 1.35rem; }
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--ms-line); background: var(--ms-surface); }
    table { width: 100%; }
    .product-cell { display: flex; align-items: center; gap: 10px; min-width: 210px; padding: 6px 0; }
    .product-thumb { width: 44px; height: 44px; border-radius: 9px; overflow: hidden; background: var(--ms-surface-3); display: grid; place-items: center; flex: 0 0 44px; }
    .product-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .product-thumb mat-icon { font-size: 22px; width: 22px; height: 22px; color: var(--ms-text-muted); }
    .product-cell strong { display: block; }
    .product-cell small { color: var(--ms-text-muted); font-size: .74rem; }
    .price-cell { display: grid; gap: 2px; font-size: .76rem; white-space: nowrap; }
    .price-cell span { display: flex; justify-content: space-between; gap: 10px; color: var(--ms-text-muted); }
    .price-cell strong { color: var(--ms-text); }
    .margin { display: inline-flex; flex-direction: column; font-weight: 700; }
    .margin small { color: var(--ms-text-muted); font-weight: 500; }
    .margin.bad { color: var(--ms-error, #b42318); }
    .low-stock { color: var(--ms-error, #b42318); font-weight: 700; }
    .muted { color: var(--ms-text-muted); }
    .row-actions { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
    .status-chip { text-transform: capitalize; font-size: .75rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--ms-surface-3); }
    .status-chip--active { background: var(--ms-primary-soft, #e9f6ef); color: var(--ms-primary-strong, #155e3a); }
    .status-chip--draft { background: #fff7e6; color: #8a5a00; }
    .status-chip--inactive, .status-chip--archived { background: var(--ms-surface-3); color: var(--ms-text-muted); }
    .state-card { display: grid; place-items: center; gap: 8px; padding: 48px 20px; text-align: center; border: 1px dashed var(--ms-line); border-radius: 14px; }
    .state-card mat-icon { font-size: 38px; width: 38px; height: 38px; color: var(--ms-text-muted); }
    .state-card h3, .state-card p { margin: 0; }
    button { min-height: 44px; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class AdminProductsComponent implements OnInit {
  private readonly products = inject(AdminProductsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<AdminProduct[]>([]);
  protected readonly wizardOpen = signal(false);
  protected readonly editingProduct = signal<AdminProduct | null>(null);

  protected readonly displayedColumns = ['name', 'price', 'margin', 'stock', 'commission', 'status', 'action'];

  protected readonly activeCount = computed(() => this.rows().filter((row) => row.status === 'active').length);
  protected readonly draftCount = computed(() => this.rows().filter((row) => row.status === 'draft').length);
  protected readonly blockedCount = computed(() => this.rows().filter((row) => (
    row.pricing?.status === 'blocked' || row.pricing?.status === 'incomplete'
  )).length);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.products
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected openNew(): void {
    this.editingProduct.set(null);
    this.wizardOpen.set(true);
    this.notice.set(null);
  }

  protected openEdit(row: AdminProduct): void {
    this.editingProduct.set(row);
    this.wizardOpen.set(true);
    this.notice.set(null);
  }

  protected closeWizard(): void {
    this.wizardOpen.set(false);
    this.editingProduct.set(null);
    this.reload();
  }

  protected onSaved(product: AdminProduct): void {
    const name = product.name ?? 'Product';
    const published = product.status === 'active';
    this.notice.set(`${name} ${published ? 'published' : 'saved as draft'}.`);
    this.closeWizard();
  }

  protected publish(row: AdminProduct): void {
    const id = String(row._id ?? row.id ?? '');
    if (!id) return;
    this.products.publish(id).subscribe({
      next: () => {
        this.notice.set(`${row.name ?? 'Product'} published.`);
        this.reload();
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  protected cover(row: AdminProduct): string {
    const first = [...(row.media ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    if (first) return first.type === 'video' ? (first.thumbnailUrl || row.img || '') : first.url;
    return row.img ?? '';
  }

  protected legacyMediaCount(row: AdminProduct): number {
    return [row.img, ...(row.gallery ?? [])].filter(Boolean).length;
  }

  protected money(value: number | undefined | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
    return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
}
