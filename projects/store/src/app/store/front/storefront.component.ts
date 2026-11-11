import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SeoService } from '../../_common/services/seo.service';
import { environment } from '../../../environments/environment';
import { StoreDetail, StoreMarketing, StoreProductPublic, StorePublic } from '../store.models';
import {
  StoreService,
  storeAssetUrl,
  storeError,
  storeProductCover,
  storeProductHasVideo,
} from '../store.service';
import { scrollToSection } from '../../_common/utils/scroll-to-section';

@Component({
  selector: 'async-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, MatIconModule, RouterModule],
})
export class StorefrontComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<StoreDetail | null>(null);
  protected readonly category = signal('all');

  protected readonly store = computed(() => this.detail()?.store ?? null);
  protected readonly products = computed(() => this.detail()?.products ?? []);
  protected readonly marketing = computed<StoreMarketing | null>(() => this.store()?.marketing ?? null);
  protected readonly hasMarketing = computed(() => {
    const m = this.marketing();
    return !!m && Boolean(
      m.headline || m.subHeadline || m.aboutStory || m.bio || m.opportunityPoints.length || m.testimonial,
    );
  });

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

  protected scrollToShop(event: Event): void {
    scrollToSection(event, 'shop');
  }

  protected storeImage(store: StorePublic): string {
    return storeAssetUrl(store.banner);
  }

  protected logoImage(store: StorePublic): string {
    return storeAssetUrl(store.logo);
  }

  protected productImage(product: StoreProductPublic): string {
    return storeProductCover(product);
  }

  protected productHasVideo(product: StoreProductPublic): boolean {
    return storeProductHasVideo(product);
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

  protected joinUrl(): string | null {
    const store = this.store();
    if (!store?.slug) return null;
    const base = String((environment as { platformUrl?: string }).platformUrl ?? '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/join?ref=${encodeURIComponent(store.slug)}`;
  }

  protected marketingWhatsApp(marketing: StoreMarketing): string {
    const raw = String(marketing.whatsappChatLink || '').trim();
    if (raw) return raw;
    return this.whatsappLink(this.store() as StorePublic);
  }

  protected marketingHeroTitle(marketing: StoreMarketing): string {
    return marketing.headline || marketing.businessTagline || `Meet ${marketing.name}`;
  }

  protected marketingHeroSub(marketing: StoreMarketing): string {
    return marketing.subHeadline || marketing.jobTitle || 'Independent MarketSpase partner';
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
          if (store.slug && store.slug !== slug) {
            this.router.navigate(['/', store.slug], { replaceUrl: true });
            return;
          }
          this.seo.setPage({
            title: `${store.name} | MarketSpase Store`,
            description: store.tagline || `Shop from ${store.name} on MarketSpase Store.`,
            path: `/${store.slug}`,
            image: store.banner || store.logo || undefined,
          });
        },
        error: (err: unknown) => {
          this.storesApi.resolveStore(slug)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (resolved) => {
                if (resolved.data.canonical) {
                  this.error.set(storeError(err));
                  this.loading.set(false);
                  return;
                }
                this.router.navigate(['/', resolved.data.slug], { replaceUrl: true });
              },
              error: () => {
                this.error.set(storeError(err));
                this.loading.set(false);
              },
            });
        },
      });
  }
}
