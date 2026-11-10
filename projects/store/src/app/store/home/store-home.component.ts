import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../_common/services/seo.service';
import { StorePublic } from '../store.models';
import { StoreService, storeAssetUrl, storeError } from '../store.service';

@Component({
  selector: 'async-store-home',
  templateUrl: './store-home.component.html',
  styleUrls: ['./store-home.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterModule],
})
export class StoreHomeComponent implements OnInit {
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stores = signal<StorePublic[]>([]);
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');

  protected readonly categories = [
    { label: 'Wellness drinks', value: 'Wellness drinks' },
    { label: 'Personal care', value: 'Personal care' },
    { label: 'Wellness tech', value: 'Wellness tech' },
    { label: 'Family health', value: 'Family health' },
    { label: 'Essentials', value: 'Essentials' },
  ];

  ngOnInit(): void {
    this.seo.setPage({
      title: 'MarketSpase Store | Shop independent partner stores',
      description: 'Discover trusted products from independent MarketSpase partners. Shop directly from real people.',
      path: '/',
    });

    this.storesApi.listStores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.stores.set(response.data ?? []);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.loading.set(false);
        },
      });
  }

  protected storeImage(store: StorePublic): string {
    return storeAssetUrl(store.banner || store.logo);
  }

  protected initials(store: StorePublic): string {
    return String(store.name || store.slug || 'S').trim().slice(0, 1).toUpperCase();
  }
}
