import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';
import { suggestClosest } from '@marketspase/shared/core/ui/text-suggestions';
import { SeoService } from '../../_common/services/seo.service';
import { environment } from '../../../environments/environment';
import { StorePublic } from '../store.models';
import { StoreService, storeAssetUrl, storeError } from '../store.service';

@Component({
  selector: 'async-store-directory',
  templateUrl: './store-directory.component.html',
  styleUrls: ['./store-directory.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ErrorStateComponent, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent, RouterModule, StatePanelComponent],
})
export class StoreDirectoryComponent implements OnInit {
  private readonly storesApi = inject(StoreService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stores = signal<StorePublic[]>([]);
  protected readonly catalogue = signal<StorePublic[]>([]);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly query = signal('');
  private nextCursor: string | null = null;
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');

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

  protected applySuggestion(value: string): void {
    this.query.set(value);
    this.load();
  }

  protected clearAndSearch(): void {
    this.query.set('');
    this.suggestions.set([]);
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
    this.suggestions.set([]);
    this.hasMore.set(false);
    this.nextCursor = null;
    this.storesApi.listStores(this.query(), { limit: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = response.data ?? [];
          this.stores.set(rows);
          this.nextCursor = response.meta?.nextCursor ?? null;
          this.hasMore.set(response.meta?.hasMore === true && Boolean(this.nextCursor));
          if (!this.query().trim()) this.catalogue.set(rows);
          if (rows.length === 0 && this.query().trim()) this.buildSuggestions();
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.loading.set(false);
        },
      });
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore() || !this.nextCursor) return;
    this.loadingMore.set(true);
    this.storesApi.listStores(this.query(), { limit: 30, cursor: this.nextCursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = response.data ?? [];
          const seen = new Set(this.stores().map((store) => store.slug));
          const fresh = rows.filter((store) => !seen.has(store.slug));
          this.stores.update((current) => [...current, ...fresh]);
          if (!this.query().trim()) {
            this.catalogue.update((current) => [...current, ...fresh]);
          }
          this.nextCursor = response.meta?.nextCursor ?? null;
          this.hasMore.set(response.meta?.hasMore === true && Boolean(this.nextCursor));
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  private buildSuggestions(): void {
    const names = this.catalogue().map((store) => store.name).filter(Boolean);
    if (names.length > 0) {
      this.suggestions.set(suggestClosest(this.query(), names, 3));
      return;
    }
    this.storesApi.listStores('', { limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rows = response.data ?? [];
          this.catalogue.set(rows);
          this.suggestions.set(suggestClosest(this.query(), rows.map((store) => store.name), 3));
        },
        error: () => undefined,
      });
  }
}
