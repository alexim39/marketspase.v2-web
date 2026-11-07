import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterModule } from '@angular/router';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';
import { GetProductService } from '../get-product.service';
import { ProductInterface, ProductService } from '../monthly-purchase.service';
import {
  CATEGORY_ORDER,
  isOutOfStock,
  isPriced,
  productCategory,
  productImage,
  productPrice,
  productSummary,
  stockLabel,
} from '../product-display';

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'name';

/**
 * Products — the catalog members and partners buy from.
 *
 * One catalog for both audiences: personal use and resale will share the
 * same products later, so the shop stays simple and checkout keeps using the
 * existing wallet flow.
 */
@Component({
  selector: 'async-product-catalog',
  templateUrl: './product-catalog.component.html',
  styleUrls: ['./product-catalog.component.scss'],
  providers: [ProductService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    RouterModule,
  ],
})
export class ProductCatalogComponent {
  private readonly productsApi = inject(ProductService);
  private readonly cartApi = inject(GetProductService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly failed = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly products = signal<ProductInterface[]>([]);
  private nextSkip = 0;
  protected readonly query = signal('');
  protected readonly category = signal('all');
  protected readonly sort = signal<SortKey>('recommended');

  protected readonly cart = toSignal(this.cartApi.cart$, {
    initialValue: [] as ProductInterface[],
  });

  protected readonly categories = computed(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const product of this.products()) {
      const category = productCategory(product);
      const row = counts.get(category.key) ?? { ...category, count: 0 };
      row.count += 1;
      counts.set(category.key, row);
    }

    const ordered = [...counts.values()].sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.key);
      const bIndex = CATEGORY_ORDER.indexOf(b.key);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex)
        || a.label.localeCompare(b.label);
    });

    return [
      { key: 'all', label: 'All products', count: this.products().length },
      ...ordered,
    ];
  });

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();

    const filtered = this.products().filter((product) => {
      if (category !== 'all' && productCategory(product).key !== category) return false;
      if (!query) return true;
      const haystack = `${product.name ?? ''} ${product.shortDesc ?? ''} ${product.desc ?? ''} ${product.category ?? ''}`
        .toLowerCase();
      return haystack.includes(query);
    });

    return this.sortProducts(filtered, this.sort());
  });

  protected readonly cartCount = computed(() => (
    this.cart().reduce((total, item) => total + (item.quantity ?? 1), 0)
  ));

  protected readonly cartTotal = computed(() => (
    this.cart().reduce((total, item) => total + productPrice(item) * (item.quantity ?? 1), 0)
  ));

  protected readonly quantitiesInCart = computed(() => {
    const map = new Map<string, number>();
    for (const item of this.cart()) {
      map.set(`${item._id}:${item.saleMode ?? 'personal'}`, item.quantity ?? 1);
    }
    return map;
  });

  protected readonly activeCategoryLabel = computed(() => (
    this.categories().find((category) => category.key === this.category())?.label ?? 'Products'
  ));

  protected readonly resultTitle = computed(() => {
    if (this.query().trim()) return `Results for “${this.query().trim()}”`;
    return this.category() === 'all' ? 'Everything in the shop' : this.activeCategoryLabel();
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.nextSkip = 0;

    this.productsApi.getAllProducts({ limit: 60, skip: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = (response.data ?? []).filter((product) => product.status !== 'inactive' && product.status !== 'archived');
          this.products.set(rows);
          this.nextSkip = response.data?.length ?? rows.length;
          this.hasMore.set(response.meta?.hasMore === true);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.productsApi.getAllProducts({ limit: 60, skip: this.nextSkip })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = (response.data ?? []).filter((product) => product.status !== 'inactive' && product.status !== 'archived');
          const seen = new Set(this.products().map((product) => product._id));
          this.products.update((current) => [...current, ...rows.filter((product) => !seen.has(product._id))]);
          this.nextSkip += response.data?.length ?? rows.length;
          this.hasMore.set(response.meta?.hasMore === true);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  protected setQuery(value: string): void {
    this.query.set(String(value ?? ''));
  }

  protected setCategory(key: string): void {
    this.category.set(key);
  }

  protected setSort(value: SortKey): void {
    this.sort.set(value);
  }

  protected categoryOf(product: ProductInterface) {
    return productCategory(product);
  }

  protected stockOf(product: ProductInterface) {
    return stockLabel(product);
  }

  protected imageOf(product: ProductInterface): string {
    return productImage(product);
  }

  protected summaryOf(product: ProductInterface): string {
    return productSummary(product);
  }

  protected outOfStock(product: ProductInterface): boolean {
    return isOutOfStock(product);
  }

  protected priced(product: ProductInterface): boolean {
    return isPriced(product);
  }

  protected quantityInCart(product: ProductInterface): number {
    return this.quantitiesInCart().get(`${product._id}:personal`) ?? 0;
  }

  protected addToCart(product: ProductInterface, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (!isPriced(product)) {
      this.ui.info('This product is price-on-request. Contact support for the current price.');
      return;
    }

    if (isOutOfStock(product)) {
      this.ui.info('This product is currently out of stock.');
      return;
    }

    this.cartApi.addToCart({ ...product, saleMode: 'personal' });
    this.ui.success(`${product.name} added to your cart.`);
  }

  protected hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }

  protected scrollToCatalog(): void {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected goToCheckout(): void {
    if (this.cartCount() === 0) return;
    void this.router.navigate(['/dashboard/checkout']);
  }

  private sortProducts(products: ProductInterface[], sort: SortKey): ProductInterface[] {
    const copy = [...products];

    if (sort === 'price-asc') {
      copy.sort((a, b) => productPrice(a) - productPrice(b));
    } else if (sort === 'price-desc') {
      copy.sort((a, b) => productPrice(b) - productPrice(a));
    } else if (sort === 'name') {
      copy.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
    } else {
      copy.sort((a, b) => (
        (isPriced(b) ? 1 : 0) - (isPriced(a) ? 1 : 0)
        || (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
        || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
        || String(a.name ?? '').localeCompare(String(b.name ?? ''))
      ));
    }

    return copy;
  }
}
