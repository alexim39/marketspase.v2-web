import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { ProductCatalogFacade } from '../state/product-catalog.facade';

@Component({
  selector: 'async-product-catalog-desktop',
  templateUrl: './product-catalog.component.html',
  styleUrls: ['./product-catalog.component.scss'],
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
export class ProductCatalogDesktopComponent {
  private readonly facade = inject(ProductCatalogFacade);

  protected readonly loading = this.facade.loading;
  protected readonly loadingMore = this.facade.loadingMore;
  protected readonly failed = this.facade.failed;
  protected readonly hasMore = this.facade.hasMore;
  protected readonly products = this.facade.products;
  protected readonly query = this.facade.query;
  protected readonly category = this.facade.category;
  protected readonly sort = this.facade.sort;
  protected readonly cart = this.facade.cart;
  protected readonly categories = this.facade.categories;
  protected readonly visible = this.facade.visible;
  protected readonly cartCount = this.facade.cartCount;
  protected readonly cartTotal = this.facade.cartTotal;
  protected readonly activeCategoryLabel = this.facade.activeCategoryLabel;
  protected readonly resultTitle = this.facade.resultTitle;

  protected setQuery(value: string): void { this.facade.setQuery(value); }
  protected setCategory(key: string): void { this.facade.setCategory(key); }
  protected setSort(value: string): void { this.facade.setSort(value); }
  protected categoryOf(product: Parameters<ProductCatalogFacade['categoryOf']>[0]) { return this.facade.categoryOf(product); }
  protected stockOf(product: Parameters<ProductCatalogFacade['stockOf']>[0]) { return this.facade.stockOf(product); }
  protected imageOf(product: Parameters<ProductCatalogFacade['imageOf']>[0]): string { return this.facade.imageOf(product); }
  protected hasVideo(product: Parameters<ProductCatalogFacade['hasVideo']>[0]): boolean { return this.facade.hasVideo(product); }
  protected summaryOf(product: Parameters<ProductCatalogFacade['summaryOf']>[0]): string { return this.facade.summaryOf(product); }
  protected outOfStock(product: Parameters<ProductCatalogFacade['outOfStock']>[0]): boolean { return this.facade.outOfStock(product); }
  protected priced(product: Parameters<ProductCatalogFacade['priced']>[0]): boolean { return this.facade.priced(product); }
  protected quantityInCart(product: Parameters<ProductCatalogFacade['quantityInCart']>[0]): number { return this.facade.quantityInCart(product); }
  protected addToCart(product: Parameters<ProductCatalogFacade['addToCart']>[0], event?: Event): void { this.facade.addToCart(product, event); }
  protected hideBrokenImage(event: Event): void { this.facade.hideBrokenImage(event); }
  protected scrollToCatalog(): void { this.facade.scrollToCatalog(); }
  protected goToCheckout(): void { this.facade.goToCheckout(); }
  protected loadMore(): void { this.facade.loadMore(); }
  protected load(): void { this.facade.load(); }
}
