import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { SeoService } from '../../_common/services/seo.service';
import { StorePublic } from '../store.models';
import { StoreService, storeAssetUrl, storeError } from '../store.service';

@Component({
  selector: 'async-store-directory',
  templateUrl: './store-directory.component.html',
  styleUrls: ['./store-directory.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [EmptyStateComponent, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent, RouterModule],
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
