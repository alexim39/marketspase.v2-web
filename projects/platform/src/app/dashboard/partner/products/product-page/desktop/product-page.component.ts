import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MediaGalleryComponent } from '@marketspase/shared/ui/media-gallery/media-gallery.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { RouterModule } from '@angular/router';
import { ProductPageFacade } from '../state/product-page.facade';

@Component({
  selector: 'async-product-page-desktop',
  templateUrl: './product-page.component.html',
  styleUrls: ['./product-page.component.scss'],
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
export class ProductPageDesktopComponent implements OnInit {
  private readonly facade = inject(ProductPageFacade);

  protected readonly product = this.facade.product;
  protected readonly related = this.facade.related;
  protected readonly quantity = this.facade.quantity;
  protected readonly loading = this.facade.loading;
  protected readonly failed = this.facade.failed;
  protected readonly cart = this.facade.cart;
  protected readonly gallery = this.facade.gallery;
  protected readonly category = this.facade.category;
  protected readonly stock = this.facade.stock;
  protected readonly benefits = this.facade.benefits;
  protected readonly summary = this.facade.summary;
  protected readonly description = this.facade.description;
  protected readonly howToUse = this.facade.howToUse;
  protected readonly deliveryNote = this.facade.deliveryNote;
  protected readonly maxQuantity = this.facade.maxQuantity;
  protected readonly priced = this.facade.priced;
  protected readonly addedQuantity = this.facade.addedQuantity;
  protected readonly cartCount = this.facade.cartCount;
  protected readonly isPartner = this.facade.isPartner;

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected outOfStock(product: Parameters<ProductPageFacade['outOfStock']>[0]): boolean { return this.facade.outOfStock(product); }
  protected pricedItem(product: Parameters<ProductPageFacade['pricedItem']>[0]): boolean { return this.facade.pricedItem(product); }
  protected imageOf(product: Parameters<ProductPageFacade['imageOf']>[0]): string { return this.facade.imageOf(product); }
  protected hasVideo(product: Parameters<ProductPageFacade['hasVideo']>[0]): boolean { return this.facade.hasVideo(product); }
  protected retry(): void { this.facade.retry(); }
  protected increment(): void { this.facade.increment(); }
  protected decrement(): void { this.facade.decrement(); }
  protected addToCart(goToCheckout = false): void { this.facade.addToCart(goToCheckout); }
  protected buyNow(): void { this.facade.buyNow(); }
  protected share(): void { this.facade.share(); }
  protected hideBrokenImage(event: Event): void { this.facade.hideBrokenImage(event); }
}
