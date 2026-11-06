import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminProductsService, AdminProduct, AdminProductStatus } from './admin-products.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Products — admin catalog editor.
 *
 * Create + edit name/price/description/image over the admin-guarded
 * endpoints (the legacy unguarded PUT stays untouched). No delete:
 * carts reference products, so removal would orphan order history.
 * OnPush + signals.
 */
@Component({
  selector: 'async-admin-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterModule],
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
          <h2>Products</h2>
          <p class="subtitle">
            Gross margin = price − COGS − shipping − 1.5% payment fee. Unilevel
            commission only runs when <strong>Commission</strong> is on.
          </p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      <div class="dp-card edit-card">
        <h3>{{ editingId() ? 'Edit product' : 'New product' }}</h3>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput [value]="form().name" (input)="setField('name', $any($event.target).value)" maxlength="200" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <input matInput [value]="form().category" (input)="setField('category', $any($event.target).value)" maxlength="80" placeholder="Wellness drinks" />
        </mat-form-field>
        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>Price (₦)</mat-label>
            <input matInput type="number" [value]="form().price ?? ''" (input)="setPrice($any($event.target).valueAsNumber)" min="0" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>COGS (₦)</mat-label>
            <input matInput type="number" [value]="form().cogs ?? ''" (input)="setNumber('cogs', $any($event.target).valueAsNumber)" min="0" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Shipping cost (₦)</mat-label>
            <input matInput type="number" [value]="form().shippingCost ?? ''" (input)="setNumber('shippingCost', $any($event.target).valueAsNumber)" min="0" step="0.01" />
          </mat-form-field>
        </div>
        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>Partner price (₦)</mat-label>
            <input matInput type="number" [value]="form().partnerPrice ?? ''" (input)="setNumber('partnerPrice', $any($event.target).valueAsNumber)" min="0" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Suggested retail (₦)</mat-label>
            <input matInput type="number" [value]="form().retailPrice ?? ''" (input)="setNumber('retailPrice', $any($event.target).valueAsNumber)" min="0" step="0.01" />
          </mat-form-field>
          <div class="resale-preview">
            @if (resalePreview(); as preview) {
              <span>Resale margin</span>
              <strong>₦{{ preview.margin | number:'1.0-2' }}</strong>
              <small>{{ preview.percent }}% of suggested retail</small>
            } @else {
              <span>Resale margin</span>
              <small>Set both prices to show the partner margin.</small>
            }
          </div>
        </div>
        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>Stock (blank = available)</mat-label>
            <input matInput type="number" [value]="form().stock ?? ''" (input)="setNumber('stock', $any($event.target).valueAsNumber)" min="0" step="1" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [value]="form().status" (selectionChange)="setStatus($event.value)">
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
              <mat-option value="archived">Archived</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-checkbox [checked]="form().commissionable" (change)="setCommissionable($event.checked)">
          Pay unilevel commission on this product
        </mat-checkbox>
        <p class="hint">
          Turn this on only after COGS and shipping are correct. Without a cost
          basis the platform could pay more than it earns.
        </p>
        @if (marginPreview(); as preview) {
          <p class="hint preview">
            Per unit: margin <strong>₦{{ preview.margin | number:'1.0-2' }}</strong>,
            maximum unilevel <strong>₦{{ preview.payout | number:'1.0-2' }}</strong>.
          </p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Short description (card + search)</mat-label>
          <input matInput [value]="form().shortDesc" (input)="setField('shortDesc', $any($event.target).value)" maxlength="240" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" [value]="form().desc" (input)="setField('desc', $any($event.target).value)" maxlength="8000"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Primary image URL or catalog slug</mat-label>
          <input matInput [value]="form().img" (input)="setField('img', $any($event.target).value)" maxlength="500" />
        </mat-form-field>

        <h4 class="section-title">Storefront content</h4>
        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>SKU</mat-label>
            <input matInput [value]="form().sku" (input)="setField('sku', $any($event.target).value)" maxlength="64" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sort order</mat-label>
            <input matInput type="number" [value]="form().sortOrder ?? ''" (input)="setNumber('sortOrder', $any($event.target).valueAsNumber)" step="1" />
          </mat-form-field>
          <div class="check-field">
            <mat-checkbox [checked]="form().featured" (change)="setFeatured($event.checked)">
              Featured product
            </mat-checkbox>
            <small>Featured products rise to the top of the shop.</small>
          </div>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Gallery images (one URL or slug per line)</mat-label>
          <textarea matInput rows="3" [value]="form().gallery" (input)="setField('gallery', $any($event.target).value)" placeholder="liven-coffee&#10;liven-coffee-pack"></textarea>
          <mat-hint>Up to 8. The primary image is used in the grid.</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Benefits (one per line)</mat-label>
          <textarea matInput rows="3" [value]="form().benefits" (input)="setField('benefits', $any($event.target).value)" placeholder="Genuine product&#10;Wallet checkout&#10;Order tracking"></textarea>
          <mat-hint>Up to 8 short lines shown on the product page.</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>How to use</mat-label>
          <textarea matInput rows="3" [value]="form().howToUse" (input)="setField('howToUse', $any($event.target).value)" maxlength="1200"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Delivery and returns note</mat-label>
          <textarea matInput rows="3" [value]="form().deliveryNote" (input)="setField('deliveryNote', $any($event.target).value)" maxlength="1200"></textarea>
        </mat-form-field>
        <div class="edit-actions">
          <span class="spacer"></span>
          @if (editingId()) {
            <button mat-button (click)="cancelEdit()">Cancel</button>
          }
          <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !valid()">{{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Create product' }}</button>
        </div>
        @if (saveError(); as err) {
          <p class="error" role="alert">{{ err }}</p>
        }
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Product</th>
              <td mat-cell *matCellDef="let row"><strong>{{ row.name ?? '—' }}</strong></td>
            </ng-container>
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef>Price</th>
              <td mat-cell *matCellDef="let row">₦{{ row.price | number:'1.0-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="cogs">
              <th mat-header-cell *matHeaderCellDef>COGS</th>
              <td mat-cell *matCellDef="let row">₦{{ row.cogs ?? 0 | number:'1.0-2' }}</td>
            </ng-container>
            <ng-container matColumnDef="resale">
              <th mat-header-cell *matHeaderCellDef>Resale</th>
              <td mat-cell *matCellDef="let row">
                @if (row.partnerPrice && row.retailPrice) {
                  <span>₦{{ row.partnerPrice | number:'1.0-0' }} → ₦{{ row.retailPrice | number:'1.0-0' }}</span>
                } @else {
                  <span class="muted">—</span>
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
              <td mat-cell *matCellDef="let row">{{ row.status ?? 'active' }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="startEdit(row)">Edit</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No products yet.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { color: var(--ms-success); }
    .edit-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; max-width: 760px; }
    .edit-card h3 { margin: 0; }
    .section-title {
      margin: 0.35em 0 -0.15em;
      padding-top: 0.6em;
      border-top: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.78em;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .check-field {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.1em;
      min-height: 56px;
    }
    .check-field small { color: var(--ms-text-muted); font-size: 0.7em; line-height: 1.35; }
    .field-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6em; }
    .resale-preview {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.12em;
      min-height: 56px;
      padding: 0.45em 0.7em;
      background: var(--ms-canvas);
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-sm);
    }
    .resale-preview span { color: var(--ms-text-muted); font-size: 0.68em; text-transform: uppercase; letter-spacing: 0.04em; }
    .resale-preview strong { color: var(--ms-primary-strong); font-size: 1em; }
    .resale-preview small { color: var(--ms-text-muted); font-size: 0.7em; line-height: 1.35; }
    .low-stock { color: var(--ms-warning); font-weight: 750; }
    .hint { margin: -0.3em 0 0; color: var(--ms-text-muted); font-size: 0.8em; line-height: 1.45; max-width: 46em; }
    .hint.preview { color: var(--ms-text); background: var(--ms-surface-3); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-sm); padding: 0.55em 0.7em; }
    .hint.preview strong { color: var(--ms-primary-strong); }
    .edit-actions { display: flex; align-items: center; gap: 0.5em; }
    .edit-actions .spacer { flex: 1; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .empty { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    button { min-height: 44px; }
    @media (max-width: 700px) {
      .field-row { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminProductsComponent implements OnInit {
  private readonly products = inject(AdminProductsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<AdminProduct[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal({
    name: '',
    price: null as number | null,
    desc: '',
    img: '',
    category: '',
    cogs: null as number | null,
    shippingCost: null as number | null,
    partnerPrice: null as number | null,
    retailPrice: null as number | null,
    stock: null as number | null,
    commissionable: false,
    status: 'active' as AdminProductStatus,
    sku: '',
    shortDesc: '',
    gallery: '',
    benefits: '',
    howToUse: '',
    deliveryNote: '',
    featured: false,
    sortOrder: null as number | null,
  });

  protected readonly displayedColumns = ['name', 'price', 'cogs', 'resale', 'stock', 'commission', 'status', 'action'];

  protected readonly resalePreview = computed(() => {
    const f = this.form();
    const partner = Number(f.partnerPrice);
    const retail = Number(f.retailPrice);
    if (!Number.isFinite(partner) || !Number.isFinite(retail) || partner <= 0 || retail <= 0) return null;
    return {
      margin: Math.round((retail - partner) * 100) / 100,
      percent: Math.round(((retail - partner) / retail) * 100),
    };
  });

  protected readonly marginPreview = computed(() => {
    const f = this.form();
    const price = Number(f.price);
    const cogs = Number(f.cogs);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(cogs) || cogs <= 0) return null;
    const shipping = Math.max(Number(f.shippingCost) || 0, 0);
    const margin = Math.max(price - cogs - shipping - (price * 0.015), 0);
    return {
      margin: Math.round(margin * 100) / 100,
      payout: Math.round(margin * 0.185 * 100) / 100,
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  protected valid(): boolean {
    const f = this.form();
    const priceReady = f.price !== null && Number.isFinite(f.price) && f.price >= 0;
    const costReady = !f.commissionable || (f.cogs !== null && Number.isFinite(f.cogs) && f.cogs > 0);
    return f.name.trim().length > 0 && priceReady && costReady;
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

  protected setField(
    field: 'name' | 'desc' | 'img' | 'category' | 'sku' | 'shortDesc' | 'gallery' | 'benefits' | 'howToUse' | 'deliveryNote',
    value: string,
  ): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  protected setPrice(value: number): void {
    this.form.update((f) => ({ ...f, price: Number.isFinite(value) ? value : null }));
  }

  protected setNumber(field: 'cogs' | 'shippingCost' | 'partnerPrice' | 'retailPrice' | 'stock' | 'sortOrder', value: number): void {
    this.form.update((f) => ({ ...f, [field]: Number.isFinite(value) ? value : null }));
  }

  protected setFeatured(value: boolean): void {
    this.form.update((f) => ({ ...f, featured: value }));
  }

  protected setStatus(value: AdminProductStatus): void {
    this.form.update((f) => ({ ...f, status: value }));
  }

  protected setCommissionable(value: boolean): void {
    this.form.update((f) => ({ ...f, commissionable: value }));
  }

  protected startEdit(row: AdminProduct): void {
    this.editingId.set(String(row._id ?? row.id ?? ''));
    this.form.set({
      name: row.name ?? '',
      price: typeof row.price === 'number' ? row.price : null,
      desc: row.desc ?? '',
      img: row.img ?? '',
      category: row.category ?? '',
      cogs: typeof row.cogs === 'number' ? row.cogs : null,
      shippingCost: typeof row.shippingCost === 'number' ? row.shippingCost : null,
      partnerPrice: typeof row.partnerPrice === 'number' ? row.partnerPrice : null,
      retailPrice: typeof row.retailPrice === 'number' ? row.retailPrice : null,
      stock: typeof row.stock === 'number' ? row.stock : null,
      commissionable: row.commissionable === true,
      status: row.status ?? 'active',
      sku: row.sku ?? '',
      shortDesc: row.shortDesc ?? '',
      gallery: (row.gallery ?? []).join('\n'),
      benefits: (row.benefits ?? []).join('\n'),
      howToUse: row.howToUse ?? '',
      deliveryNote: row.deliveryNote ?? '',
      featured: row.featured === true,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : null,
    });
    this.saveError.set(null);
    this.notice.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.set({
      name: '',
      price: null,
      desc: '',
      img: '',
      category: '',
      cogs: null,
      shippingCost: null,
      partnerPrice: null,
      retailPrice: null,
      stock: null,
      commissionable: false,
      status: 'active',
      sku: '',
      shortDesc: '',
      gallery: '',
      benefits: '',
      howToUse: '',
      deliveryNote: '',
      featured: false,
      sortOrder: null,
    });
    this.saveError.set(null);
  }

  protected save(): void {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.notice.set(null);
    const id = this.editingId();
    const req = id
      ? this.products.update(id, { ...this.form() })
      : this.products.create({ ...this.form(), price: this.form().price as number });
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notice.set(id ? 'Product updated.' : 'Product created.');
        this.cancelEdit();
        this.reload();
        void res;
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.saveError.set(err.message);
      },
    });
  }
}
