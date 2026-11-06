import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../_common/services/seo.service';
import { StorePublic } from '../store.models';
import { StoreService, storeAssetUrl, storeError } from '../store.service';

@Component({
  selector: 'async-store-directory',
  templateUrl: './store-directory.component.html',
  styleUrls: ['./store-directory.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, RouterModule],
})
export class StoreDirectoryComponent implements OnInit {
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stores = signal<StorePublic[]>([]);
  protected readonly query = signal('');

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Find a store | MarketSpase Store',
      description: 'Browse independent MarketSpase partner stores.',
      path: '/stores',
    });
    this.load();
  }

  protected setQuery(value: unknown): void {
    this.query.set(String(value ?? ''));
  }

  protected search(): void {
    this.load();
  }

  protected storeImage(store: StorePublic): string {
    return storeAssetUrl(store.banner || store.logo);
  }

  protected initials(store: StorePublic): string {
    return String(store.name || store.slug || 'S').trim().slice(0, 1).toUpperCase();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storesApi.listStores(this.query())
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
}
