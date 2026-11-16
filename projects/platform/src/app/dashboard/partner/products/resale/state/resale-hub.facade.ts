import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../../core/auth/auth.service';
import { userError } from '../../../../../core/http/api-error';
import { publicStorefrontUrl } from '../../../../../core/store/public-links';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';
import { GetProductService } from '../../get-product.service';
import { ProductInterface, ProductService, ResaleProductInterface } from '../../monthly-purchase.service';
import { isOutOfStock, productCategory, productHasVideo, productImage, productPrice, productSummary, stockLabel } from '../../product-display';

type SortKey = 'recommended' | 'margin' | 'price';

/** Shared resale catalog, margin calculator and cart actions. */
@Injectable()
export class ResaleHubFacade {
  private readonly productsApi = inject(ProductService);
  private readonly cartApi = inject(GetProductService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<ResaleProductInterface[]>([]);
  readonly query = signal('');
  readonly category = signal('all');
  readonly sort = signal<SortKey>('recommended');
  readonly highlightId = signal<string | null>(null);
  readonly calcProductId = signal('');
  readonly calcRetail = signal<number | null>(null);
  readonly calcQuantity = signal(1);

  readonly cart = toSignal(this.cartApi.cart$, { initialValue: [] as ProductInterface[] });
  readonly partner = computed(() => this.auth.currentUser());
  readonly isPartner = computed(() => this.partner()?.accountState === 'partner');
  readonly kycReady = computed(() => (this.partner()?.kycStatus ?? 'verified') === 'verified');
  readonly publicUrl = computed(() => {
    const handle = String(this.partner()?.storeSlug ?? this.partner()?.username ?? '').trim();
    return publicStorefrontUrl(handle);
  });

  readonly categories = computed(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const product of this.products()) {
      const category = productCategory(product);
      const row = counts.get(category.key) ?? { ...category, count: 0 };
      row.count += 1;
      counts.set(category.key, row);
    }
    return [{ key: 'all', label: 'All resale products', count: this.products().length }, ...counts.values()];
  });

  readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    const list = this.products().filter((product) => {
      if (category !== 'all' && productCategory(product).key !== category) return false;
      if (!query) return true;
      const haystack = `${product.name ?? ''} ${product.category ?? ''} ${product.shortDesc ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...list];
    if (this.sort() === 'margin') sorted.sort((a, b) => this.marginOf(b) - this.marginOf(a));
    else if (this.sort() === 'price') sorted.sort((a, b) => this.partnerPrice(a) - this.partnerPrice(b));
    return sorted;
  });

  readonly cartCount = computed(() => this.cart().reduce((total, item) => total + (item.quantity ?? 1), 0));
  readonly cartTotal = computed(() => this.cart().reduce((total, item) => total + productPrice(item) * (item.quantity ?? 1), 0));
  readonly calcProduct = computed(() => this.products().find((product) => product._id === this.calcProductId()) ?? null);
  readonly calcProfit = computed(() => {
    const product = this.calcProduct();
    const retail = Number(this.calcRetail());
    if (!product || !Number.isFinite(retail)) return 0;
    return Math.max((retail - this.partnerPrice(product)) * this.calcQuantity(), 0);
  });
  readonly calcMarginPercent = computed(() => {
    const retail = Number(this.calcRetail());
    const product = this.calcProduct();
    if (!product || !Number.isFinite(retail) || retail <= 0) return 0;
    return Math.max(((retail - this.partnerPrice(product)) / retail) * 100, 0);
  });

  constructor() {
    if (this.isPartner() && this.kycReady()) this.load();
    else this.loading.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.productsApi.getResaleProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = response.data ?? [];
          this.products.set(rows);
          this.loading.set(false);
          this.focusFromQuery(rows);
          if (rows.length > 0 && !this.calcProductId()) this.initCalculator(rows[0]);
        },
        error: (err: unknown) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  retailOf(product: ResaleProductInterface): number {
    const retail = Number(product.retailPrice);
    return Number.isFinite(retail) && retail > 0 ? retail : productPrice(product);
  }

  partnerPrice(product: ResaleProductInterface): number {
    const price = Number(product.partnerPrice);
    return Number.isFinite(price) ? price : 0;
  }

  marginOf(product: ResaleProductInterface): number {
    return this.retailOf(product) - this.partnerPrice(product);
  }

  marginPercent(product: ResaleProductInterface): number {
    const retail = this.retailOf(product);
    return retail > 0 ? Math.round((this.marginOf(product) / retail) * 100) : 0;
  }

  categoryOf(product: ResaleProductInterface): string {
    return productCategory(product).label;
  }

  imageOf(product: ResaleProductInterface): string {
    return productImage(product);
  }

  hasVideo(product: ResaleProductInterface): boolean {
    return productHasVideo(product);
  }

  summaryOf(product: ResaleProductInterface): string {
    return productSummary(product);
  }

  stockOf(product: ResaleProductInterface) {
    return stockLabel(product);
  }

  outOfStock(product: ResaleProductInterface): boolean {
    return isOutOfStock(product);
  }

  setQuery(value: string): void { this.query.set(String(value ?? '')); }
  setCategory(key: string): void { this.category.set(key); }
  setSort(value: string): void { this.sort.set(String(value ?? 'recommended') as SortKey); }

  initCalculator(product: ResaleProductInterface): void {
    this.calcProductId.set(product._id);
    this.calcRetail.set(this.retailOf(product));
    this.calcQuantity.set(1);
  }

  selectCalcProduct(id: string): void {
    const product = this.products().find((row) => row._id === id);
    if (product) this.initCalculator(product);
  }

  setCalcRetail(value: unknown): void {
    const retail = Number(value);
    this.calcRetail.set(Number.isFinite(retail) && retail > 0 ? retail : null);
  }

  setCalcQuantity(value: unknown): void {
    const quantity = Math.floor(Number(value));
    this.calcQuantity.set(Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }

  addToCart(product: ResaleProductInterface, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.outOfStock(product)) {
      this.ui.info('This product is currently out of stock.');
      return;
    }
    if (this.partnerPrice(product) <= 0) {
      this.ui.info('This product does not have a partner price yet.');
      return;
    }
    this.cartApi.addToCart({
      ...product,
      price: this.partnerPrice(product),
      saleMode: 'resale',
      retailPrice: this.retailOf(product),
    });
    this.ui.success(`${product.name} added at partner price.`);
  }

  share(product: ResaleProductInterface): void {
    const retail = this.retailOf(product);
    const summary = productSummary(product);
    const text = [
      product.name,
      `Suggested retail: ${this.money(retail)}`,
      summary,
      `Shop or join through my MarketSpase page: ${this.publicUrl()}`,
    ].join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => this.ui.success('Share caption copied.'),
        () => this.ui.info('Copy failed. Select the product details and share manually.'),
      );
    } else {
      this.ui.info('Sharing is not available in this browser.');
    }
  }

  goToCheckout(): void {
    if (this.cartCount() === 0) {
      this.ui.info('Your cart is empty.');
      return;
    }
    void this.router.navigate(['/dashboard/checkout']);
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }

  private focusFromQuery(rows: ResaleProductInterface[]): void {
    const focusId = this.route.snapshot.queryParamMap.get('product');
    if (!focusId) return;
    const match = rows.find((product) => product._id === focusId);
    if (!match) return;
    this.highlightId.set(focusId);
    this.query.set(match.name);
    this.initCalculator(match);
  }

  private money(value: number): string {
    return `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
