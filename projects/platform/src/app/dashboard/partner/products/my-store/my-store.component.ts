import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { StoreService } from '../../../../core/store/store.service';
import {
  StoreCounts,
  StoreProduct,
  StoreProfile,
  StoreReceipt,
} from '../../../../core/store/store.models';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

type Tab = 'overview' | 'listings' | 'receipts' | 'settings';

type StoreForm = {
  name: string;
  tagline: string;
  bio: string;
  logo: string;
  banner: string;
  whatsapp: string;
  phone: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  x: string;
  youtube: string;
  deliveryNote: string;
  deliveryFee: number;
  returnPolicy: string;
  autoPublish: boolean;
};

const EMPTY_FORM: StoreForm = {
  name: '',
  tagline: '',
  bio: '',
  logo: '',
  banner: '',
  whatsapp: '',
  phone: '',
  instagram: '',
  tiktok: '',
  facebook: '',
  x: '',
  youtube: '',
  deliveryNote: '',
  deliveryFee: 0,
  returnPolicy: '',
  autoPublish: false,
};

/**
 * Partner store cockpit. Stock is credited here after a received wholesale
 * order; listings are published intentionally, never silently.
 */
@Component({
  selector: 'async-my-store',
  templateUrl: './my-store.component.html',
  styleUrls: ['./my-store.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
  ],
})
export class MyStoreComponent implements OnInit {
  private readonly storeApi = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly store = signal<StoreProfile | null>(null);
  protected readonly counts = signal<StoreCounts>({ published: 0, draft: 0, paused: 0, pendingReceipts: 0 });
  protected readonly products = signal<StoreProduct[]>([]);
  protected readonly receipts = signal<StoreReceipt[]>([]);
  protected readonly form = signal<StoreForm>({ ...EMPTY_FORM });
  protected readonly priceDrafts = signal<Record<string, string>>({});
  protected readonly tab = signal<Tab>('overview');

  protected readonly isPartner = computed(() => this.auth.currentUser()?.accountState === 'partner');
  protected readonly kycReady = computed(() => (
    (this.auth.currentUser()?.kycStatus ?? 'verified') === 'verified'
  ));

  protected readonly storeUrl = computed(() => {
    const slug = this.store()?.slug ?? this.auth.currentUser()?.username ?? '';
    if (!slug) return '';
    const base = String((environment as { publicSiteUrl?: string }).publicSiteUrl ?? '')
      .replace(/\/+$/, '');
    return `${base}/${slug}`;
  });

  protected readonly readiness = computed(() => {
    const f = this.form();
    const checks = [
      Boolean(f.name.trim()),
      Boolean(f.tagline.trim()),
      Boolean(f.bio.trim()),
      Boolean(f.whatsapp.trim()),
      Boolean(f.deliveryNote.trim()),
      Boolean(f.returnPolicy.trim()),
      this.counts().published > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  });

  ngOnInit(): void {
    if (!this.isPartner() || !this.kycReady()) {
      this.loading.set(false);
      return;
    }
    this.load();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected setForm(field: keyof StoreForm, value: unknown): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  protected setPrice(id: string, value: unknown): void {
    this.priceDrafts.update((drafts) => ({ ...drafts, [id]: String(value ?? '') }));
  }

  protected priceFor(product: StoreProduct): string {
    return this.priceDrafts()[product.id] ?? String(product.retailPrice ?? '');
  }

  protected imageUrl(image: string): string {
    const value = String(image ?? '').trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) return value;
    if (value.startsWith('assets/')) return `/${value}`;
    if (/\.(png|jpe?g|webp|gif|avif)$/i.test(value)) return `/img/products/${value}`;
    return `/img/products/${value}.PNG`;
  }

  protected copyStoreLink(): void {
    const url = this.storeUrl();
    if (!url) return;
    const done = () => this.ui.success('Store link copied');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }

  protected saveSettings(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.storeApi.updateStore({ ...this.form() })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (response) => {
          this.applyStore(response.data);
          this.ui.success('Store settings saved');
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected setStoreStatus(status: 'draft' | 'published'): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.storeApi.updateStore({ status })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (response) => {
          this.applyStore(response.data);
          this.ui.success(status === 'published' ? 'Store is live' : 'Store hidden from the directory');
          this.load();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected saveListing(product: StoreProduct): void {
    const price = Number(this.priceFor(product));
    if (!Number.isFinite(price) || price <= 0) {
      this.ui.info('Enter a retail price above zero.');
      return;
    }
    this.busyId.set(product.id);
    this.error.set(null);
    this.storeApi.updateProduct(product.id, { retailPrice: price })
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.ui.success('Retail price updated');
          this.loadProducts();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected toggleListing(product: StoreProduct): void {
    const nextStatus = product.status === 'published' ? 'paused' : 'published';
    this.busyId.set(product.id);
    this.error.set(null);
    this.storeApi.updateProduct(product.id, { status: nextStatus })
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.ui.success(nextStatus === 'published' ? 'Listing published' : 'Listing paused');
          this.loadProducts();
          this.loadStore();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected confirmReceipt(receipt: StoreReceipt): void {
    this.busyId.set(receipt.id);
    this.error.set(null);
    this.storeApi.confirmReceipt(receipt.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (response) => {
          this.ui.success(`${response.data.credited} units added to your store`);
          this.load();
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected statusLabel(status: string): string {
    if (status === 'published') return 'Live';
    if (status === 'paused') return 'Paused';
    return 'Draft';
  }

  protected receiptUnits(receipt: StoreReceipt): number {
    return (receipt.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storeApi.myStore().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.applyStore(response.data.store);
        this.counts.set(response.data.counts);
        this.loadProducts();
        this.loadReceipts();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadStore(): void {
    this.storeApi.myStore().subscribe({
      next: (response) => {
        this.applyStore(response.data.store);
        this.counts.set(response.data.counts);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadProducts(): void {
    this.storeApi.myProducts().subscribe({
      next: (response) => {
        this.products.set(response.data ?? []);
        const drafts: Record<string, string> = {};
        for (const product of response.data ?? []) drafts[product.id] = String(product.retailPrice ?? '');
        this.priceDrafts.set(drafts);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadReceipts(): void {
    this.storeApi.receipts().subscribe({
      next: (response) => this.receipts.set(response.data ?? []),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private applyStore(store: StoreProfile): void {
    this.store.set(store);
    this.form.set({
      name: store.name ?? '',
      tagline: store.tagline ?? '',
      bio: store.bio ?? '',
      logo: store.logo ?? '',
      banner: store.banner ?? '',
      whatsapp: store.whatsapp ?? '',
      phone: store.phone ?? '',
      instagram: store.instagram ?? '',
      tiktok: store.tiktok ?? '',
      facebook: store.facebook ?? '',
      x: store.x ?? '',
      youtube: store.youtube ?? '',
      deliveryNote: store.deliveryNote ?? '',
      deliveryFee: Number(store.deliveryFee) || 0,
      returnPolicy: store.returnPolicy ?? '',
      autoPublish: store.autoPublish === true,
    });
  }
}
