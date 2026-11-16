import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ResaleHubFacade } from '../state/resale-hub.facade';

@Component({
  selector: 'async-resale-hub-desktop',
  templateUrl: './resale-hub.component.html',
  styleUrls: ['./resale-hub.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageSkeletonComponent,
    RouterModule,
  ],
})
export class ResaleHubDesktopComponent {
  private readonly facade = inject(ResaleHubFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly products = this.facade.products;
  protected readonly query = this.facade.query;
  protected readonly category = this.facade.category;
  protected readonly sort = this.facade.sort;
  protected readonly highlightId = this.facade.highlightId;
  protected readonly calcProductId = this.facade.calcProductId;
  protected readonly calcRetail = this.facade.calcRetail;
  protected readonly calcQuantity = this.facade.calcQuantity;
  protected readonly cart = this.facade.cart;
  protected readonly isPartner = this.facade.isPartner;
  protected readonly kycReady = this.facade.kycReady;
  protected readonly publicUrl = this.facade.publicUrl;
  protected readonly categories = this.facade.categories;
  protected readonly visible = this.facade.visible;
  protected readonly cartCount = this.facade.cartCount;
  protected readonly cartTotal = this.facade.cartTotal;
  protected readonly calcProduct = this.facade.calcProduct;
  protected readonly calcProfit = this.facade.calcProfit;
  protected readonly calcMarginPercent = this.facade.calcMarginPercent;

  protected load(): void { this.facade.load(); }
  protected retailOf(product: Parameters<ResaleHubFacade['retailOf']>[0]): number { return this.facade.retailOf(product); }
  protected partnerPrice(product: Parameters<ResaleHubFacade['partnerPrice']>[0]): number { return this.facade.partnerPrice(product); }
  protected marginOf(product: Parameters<ResaleHubFacade['marginOf']>[0]): number { return this.facade.marginOf(product); }
  protected marginPercent(product: Parameters<ResaleHubFacade['marginPercent']>[0]): number { return this.facade.marginPercent(product); }
  protected categoryOf(product: Parameters<ResaleHubFacade['categoryOf']>[0]): string { return this.facade.categoryOf(product); }
  protected imageOf(product: Parameters<ResaleHubFacade['imageOf']>[0]): string { return this.facade.imageOf(product); }
  protected hasVideo(product: Parameters<ResaleHubFacade['hasVideo']>[0]): boolean { return this.facade.hasVideo(product); }
  protected summaryOf(product: Parameters<ResaleHubFacade['summaryOf']>[0]): string { return this.facade.summaryOf(product); }
  protected stockOf(product: Parameters<ResaleHubFacade['stockOf']>[0]) { return this.facade.stockOf(product); }
  protected outOfStock(product: Parameters<ResaleHubFacade['outOfStock']>[0]): boolean { return this.facade.outOfStock(product); }
  protected setQuery(value: string): void { this.facade.setQuery(value); }
  protected setCategory(key: string): void { this.facade.setCategory(key); }
  protected setSort(value: string): void { this.facade.setSort(value); }
  protected initCalculator(product: Parameters<ResaleHubFacade['initCalculator']>[0]): void { this.facade.initCalculator(product); }
  protected selectCalcProduct(id: string): void { this.facade.selectCalcProduct(id); }
  protected setCalcRetail(value: unknown): void { this.facade.setCalcRetail(value); }
  protected setCalcQuantity(value: unknown): void { this.facade.setCalcQuantity(value); }
  protected addToCart(product: Parameters<ResaleHubFacade['addToCart']>[0], event?: Event): void { this.facade.addToCart(product, event); }
  protected share(product: Parameters<ResaleHubFacade['share']>[0]): void { this.facade.share(product); }
  protected goToCheckout(): void { this.facade.goToCheckout(); }
  protected hideBrokenImage(event: Event): void { this.facade.hideBrokenImage(event); }
}
