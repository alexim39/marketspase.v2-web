import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SeoService } from '../../_common/services/seo.service';
import { StoreProductDetail, StoreProductPublic, StorePublic } from '../store.models';
import {
  StoreService,
  storeAssetUrl,
  storeError,
  storeProductImage,
} from '../store.service';
import { CartService } from '../cart/cart.service';

@Component({
  selector: 'async-store-product',
  templateUrl: './store-product.component.html',
  styleUrls: ['./store-product.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, MatIconModule, RouterModule],
})
export class StoreProductComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cart = inject(CartService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<StoreProductDetail | null>(null);
  protected readonly activeImage = signal(0);
  protected readonly addMessage = signal<string | null>(null);
  protected readonly differentStore = signal<string | null>(null);

  protected readonly store = computed(() => this.detail()?.store ?? null);
  protected readonly product = computed(() => this.detail()?.product ?? null);
  protected readonly gallery = computed(() => {
    const product = this.product();
    if (!product) return [] as string[];
    const images = [product.image, ...(product.images ?? [])]
      .map(storeProductImage)
      .filter(Boolean);
    return [...new Set(images)];
  });

  ngOnInit(): void {
    const slug = String(this.route.snapshot.paramMap.get('username') ?? '').trim();
    const productId = String(this.route.snapshot.paramMap.get('productId') ?? '').trim();
    if (!slug || !productId) {
      this.error.set('Product not found');
      this.loading.set(false);
      return;
    }
    this.load(slug, productId);
  }

  protected selectImage(index: number): void {
    if (index < 0 || index >= this.gallery().length) return;
    this.activeImage.set(index);
  }

  protected addToCart(goToCheckout = false): void {
    const store = this.store();
    const product = this.product();
    if (!store || !product) return;
    const result = this.cart.addItem(
      {
        storeProductId: product.id,
        productId: product.productId,
        name: product.name,
        image: product.image,
        category: product.category,
        unitPrice: product.retailPrice,
        stock: product.stock,
      },
      { slug: store.slug, name: store.name, deliveryFee: store.deliveryFee },
    );

    if (result.added) {
      this.differentStore.set(null);
      this.addMessage.set(`${product.name} added to your cart.`);
      if (goToCheckout) this.router.navigate(['/checkout']);
      return;
    }
    if (result.reason === 'different-store') {
      this.differentStore.set(result.currentStore || 'another store');
      this.addMessage.set(
        `Your cart is from ${result.currentStore || 'another store'}. Clear it to add this product.`,
      );
      return;
    }
    if (result.reason === 'limit') {
      this.addMessage.set(`Only ${result.quantity ?? product.stock} available in this store.`);
      return;
    }
    this.addMessage.set('This product is currently out of stock.');
  }

  protected clearAndAdd(): void {
    this.cart.clear();
    this.differentStore.set(null);
    this.addToCart(true);
  }

  protected storeImage(store: StorePublic): string {
    return storeAssetUrl(store.banner || store.logo);
  }

  protected logoImage(store: StorePublic): string {
    return storeAssetUrl(store.logo);
  }

  protected initials(store: StorePublic): string {
    return String(store.name || store.slug || 'S').trim().slice(0, 1).toUpperCase();
  }

  protected whatsappLink(): string {
    const store = this.store();
    const product = this.product();
    if (!store || !product) return '';
    const raw = String(store.whatsapp || store.phone || '').replace(/[^\d]/g, '');
    if (!raw) return '';
    const number = raw.startsWith('0') ? `234${raw.slice(1)}` : raw;
    const message = encodeURIComponent(
      `Hello ${store.name}, I'm interested in ${product.name} (${product.retailPrice ? `₦${product.retailPrice.toLocaleString()}` : 'your store'}) on MarketSpase Store.`,
    );
    return `https://wa.me/${number}?text=${message}`;
  }

  protected share(): void {
    const url = window.location.href;
    const done = () => undefined;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    }
  }

  private load(slug: string, productId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.storesApi.getProduct(slug, productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.detail.set(response.data);
          this.loading.set(false);
          const product = response.data.product;
          const store = response.data.store;
          this.seo.setPage({
            title: `${product.name} | ${store.name} | MarketSpase Store`,
            description: product.shortDesc || `Buy ${product.name} from ${store.name} on MarketSpase Store.`,
            path: `/${store.slug}/product/${product.id}`,
            image: storeProductImage(product.image) || undefined,
          });
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.loading.set(false);
        },
      });
  }
}
