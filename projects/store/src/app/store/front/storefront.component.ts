import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SeoService } from '../../_common/services/seo.service';
import { StoreDetail, StoreProductPublic, StorePublic } from '../store.models';
import {
  StoreService,
  storeAssetUrl,
  storeError,
  storeProductImage,
} from '../store.service';

@Component({
  selector: 'async-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, RouterModule],
})
export class StorefrontComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<StoreDetail | null>(null);
  protected readonly category = signal('all');

  protected readonly store = computed(() => this.detail()?.store ?? null);
  protected readonly products = computed(() => this.detail()?.products ?? []);

  protected readonly categories = computed(() => {
    const counts = new Map<string, number>();
    for (const product of this.products()) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  protected readonly visibleProducts = computed(() => {
    const category = this.category();
    return category === 'all'
      ? this.products()
      : this.products().filter((product) => product.category === category);
  });

  ngOnInit(): void {
    const slug = String(this.route.snapshot.paramMap.get('username') ?? '').trim();
    if (!slug) {
      this.error.set('Store not found');
      this.loading.set(false);
      return;
    }
    this.load(slug);
  }

  protected setCategory(value: string): void {
    this.category.set(value);
  }

  protected storeImage(store: StorePublic): string {
    return storeAssetUrl(store.banner);
  }

  protected logoImage(store: StorePublic): string {
    return storeAssetUrl(store.logo);
  }

  protected productImage(product: StoreProductPublic): string {
    return storeProductImage(product.image);
  }

  protected initials(store: StorePublic): string {
    return String(store.name || store.slug || 'S').trim().slice(0, 1).toUpperCase();
  }

  protected categoryLabel(value: string): string {
    return value || 'Essentials';
  }

  protected whatsappLink(store: StorePublic): string {
    const raw = String(store.whatsapp || store.phone || '').replace(/[^\d]/g, '');
    if (!raw) return '';
    const number = raw.startsWith('0') ? `234${raw.slice(1)}` : raw;
    return `https://wa.me/${number}`;
  }

  protected shareStore(): void {
    const url = window.location.href;
    const done = () => undefined;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    }
  }

  private load(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.storesApi.getStore(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.detail.set(response.data);
          this.loading.set(false);
          const store = response.data.store;
          this.seo.setPage({
            title: `${store.name} | MarketSpase Store`,
            description: store.tagline || `Shop from ${store.name} on MarketSpase Store.`,
            path: `/${store.slug}`,
            image: store.banner || store.logo || undefined,
          });
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.loading.set(false);
        },
      });
  }
}
