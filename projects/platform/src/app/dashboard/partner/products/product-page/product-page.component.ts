import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MediaGalleryComponent } from '@marketspase/shared/ui/media-gallery/media-gallery.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';
import { GetProductService } from '../get-product.service';
import { ProductInterface, ProductService } from '../monthly-purchase.service';
import {
  isOutOfStock,
  isPriced,
  productBenefits,
  productCategory,
  productDeliveryNote,
  productDescription,
  productHasVideo,
  productHowToUse,
  productImage,
  productMedia,
  productSummary,
  stockLabel,
} from '../product-display';

/**
 * Full product page. Replaces the old price-and-description dialog with a
 * shareable route, quantity choice, delivery guidance and related products.
 */
@Component({
  selector: 'async-product-page',
  templateUrl: './product-page.component.html',
  styleUrls: ['./product-page.component.scss'],
  providers: [ProductService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MediaGalleryComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
})
export class ProductPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApi = inject(ProductService);
  private readonly cartApi = inject(GetProductService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly product = signal<ProductInterface | null>(null);
  protected readonly related = signal<ProductInterface[]>([]);
  protected readonly quantity = signal(1);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly cart = toSignal(this.cartApi.cart$, {
    initialValue: [] as ProductInterface[],
  });

  protected readonly gallery = computed(() => {
    const product = this.product();
    return product ? productMedia(product) : [];
  });

  protected readonly category = computed(() => {
    const product = this.product();
    return product ? productCategory(product) : { key: '', label: 'Product' };
  });

  protected readonly stock = computed(() => {
    const product = this.product();
    return product ? stockLabel(product) : { state: 'out' as const, label: '', tone: 'neutral' };
  });

  protected readonly benefits = computed(() => {
    const product = this.product();
    return product ? productBenefits(product) : [];
  });

  protected readonly summary = computed(() => {
    const product = this.product();
    return product ? productSummary(product) : '';
  });

  protected readonly description = computed(() => {
    const product = this.product();
    return product ? productDescription(product) : '';
  });

  protected readonly howToUse = computed(() => {
    const product = this.product();
    return product ? productHowToUse(product) : '';
  });

  protected readonly deliveryNote = computed(() => {
    const product = this.product();
    return product ? productDeliveryNote(product) : '';
  });

  protected readonly maxQuantity = computed(() => {
    const product = this.product();
    const stock = product?.stock;
    if (typeof stock === 'number' && Number.isFinite(stock) && stock > 0) {
      return Math.max(Math.min(Math.floor(stock), 20), 1);
    }
    return 20;
  });

  protected readonly priced = computed(() => {
    const product = this.product();
    return product ? isPriced(product) : false;
  });

  protected readonly addedQuantity = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return this.cart().find((item) => (
      item._id === product._id && (item.saleMode ?? 'personal') === 'personal'
    ))?.quantity ?? 0;
  });

  protected readonly cartCount = computed(() => (
    this.cart().reduce((total, item) => total + (item.quantity ?? 1), 0)
  ));

  protected readonly isPartner = computed(() => (
    this.auth.currentUser()?.accountState === 'partner'
  ));

  protected outOfStock(product: ProductInterface): boolean {
    return isOutOfStock(product);
  }

  protected pricedItem(product: ProductInterface): boolean {
    return isPriced(product);
  }

  protected imageOf(product: ProductInterface): string {
    return productImage(product);
  }

  protected hasVideo(product: ProductInterface): boolean {
    return productHasVideo(product);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.failed.set(true);
      return;
    }
    this.load(id);
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.failed.set(false);

    this.productsApi.getProduct(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const product = response.data ?? null;
          if (!product) {
            this.failed.set(true);
            this.loading.set(false);
            return;
          }
          this.showProduct(product);
        },
        error: () => this.loadFromCatalog(id),
      });
  }

  /** Keeps the page working against an API deployment without GET /products/:id. */
  private loadFromCatalog(id: string): void {
    this.productsApi.getAllProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const product = (response.data ?? []).find((item) => item._id === id) ?? null;
          if (!product) {
            this.failed.set(true);
            this.loading.set(false);
            return;
          }
          this.showProduct(product);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private showProduct(product: ProductInterface): void {
    this.product.set(product);
    this.quantity.set(1);
    this.loading.set(false);
    this.loadRelated(product);
  }

  private loadRelated(product: ProductInterface): void {
    this.productsApi.getAllProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const others = (response.data ?? []).filter((item) => item._id !== product._id);
          const category = productCategory(product).key;
          const sameCategory = others.filter((item) => productCategory(item).key === category);
          this.related.set((sameCategory.length > 0 ? sameCategory : others).slice(0, 4));
        },
        error: () => this.related.set([]),
      });
  }

  protected retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  protected increment(): void {
    this.quantity.update((value) => Math.min(value + 1, this.maxQuantity()));
  }

  protected decrement(): void {
    this.quantity.update((value) => Math.max(value - 1, 1));
  }

  protected addToCart(goToCheckout = false): void {
    const product = this.product();
    if (!product) return;

    if (!isPriced(product)) {
      this.ui.info('This product is price-on-request. Contact support for the current price.');
      return;
    }

    if (isOutOfStock(product)) return;

    const quantity = Math.max(Math.min(this.quantity(), this.maxQuantity()), 1);
    this.cartApi.addToCart({ ...product, saleMode: 'personal' }, quantity);
    this.ui.success(`${quantity} × ${product.name} added to your cart.`);

    if (goToCheckout) void this.router.navigate(['/dashboard/checkout']);
  }

  protected buyNow(): void {
    this.addToCart(true);
  }

  protected share(): void {
    const url = window.location.href;
    const done = () => this.ui.success('Product link copied. Share it anywhere.');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }

  protected hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }
}
