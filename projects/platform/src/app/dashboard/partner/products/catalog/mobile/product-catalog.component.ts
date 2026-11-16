import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { MobileSegmentedTabsComponent, MobileTab } from '@marketspase/shared/ui/mobile-segmented-tabs/mobile-segmented-tabs.component';
import { MobileStickyActionComponent } from '@marketspase/shared/ui/mobile-sticky-action/mobile-sticky-action.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProductCatalogFacade } from '../state/product-catalog.facade';

@Component({
  selector: 'async-product-catalog-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MobilePageShellComponent,
    MobileSegmentedTabsComponent,
    MobileStickyActionComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
  template: `
    <async-mobile-page-shell eyebrow="Products · Shop" title="Products" [showBack]="false">
      <section class="catalog-hero">
        <div>
          <p class="eyebrow">Buy for you. Stock for resale.</p>
          <h1>Everything in one shop.</h1>
          <p>Genuine products, wallet checkout and one place for every order.</p>
        </div>
        <div class="cart-chip">
          <mat-icon aria-hidden="true">shopping_bag</mat-icon>
          <strong>{{ vm.cartCount() }}</strong>
          <span>{{ vm.cartCount() === 1 ? 'item' : 'items' }}</span>
          <small>{{ vm.cartTotal() | currency:'₦':'symbol':'1.0-0' }}</small>
        </div>
      </section>

      <div class="controls">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search products</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput type="search" [ngModel]="vm.query()" (ngModelChange)="vm.setQuery($event)" placeholder="Coffee, care, wellness tech…" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Sort by</mat-label>
          <mat-select [ngModel]="vm.sort()" (ngModelChange)="vm.setSort($event)">
            <mat-option value="recommended">Recommended</mat-option>
            <mat-option value="price-asc">Price: low to high</mat-option>
            <mat-option value="price-desc">Price: high to low</mat-option>
            <mat-option value="name">Name A–Z</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <async-mobile-segmented-tabs
        class="category-tabs"
        ariaLabel="Product categories"
        [tabs]="categoryTabs()"
        [active]="vm.category()"
        (activeChange)="vm.setCategory($event)"
      />

      @if (vm.loading()) {
        <async-page-skeleton layout="cards" [rows]="6" label="products" [showHeader]="false" />
      } @else if (vm.failed()) {
        <div class="state-card">
          <mat-icon aria-hidden="true">cloud_off</mat-icon>
          <strong>We could not load the shop</strong>
          <p>Check your connection and try again.</p>
          <button mat-flat-button color="primary" type="button" (click)="vm.load()">Retry</button>
        </div>
      } @else if (vm.visible().length === 0) {
        <div class="state-card">
          <mat-icon aria-hidden="true">inventory_2</mat-icon>
          <strong>The shelf is being stocked</strong>
          <p>{{ vm.query().trim() ? 'No products match that search.' : 'New products will appear here as soon as they are added.' }}</p>
          <a mat-stroked-button routerLink="/dashboard/support/ticket">Contact support</a>
        </div>
      } @else {
        <div class="results-head">
          <div>
            <p class="eyebrow">Catalog</p>
            <h2>{{ vm.resultTitle() }}</h2>
          </div>
          <span>{{ vm.visible().length }} shown</span>
        </div>

        <div class="product-grid">
          @for (product of vm.visible(); track product._id) {
            <article class="product-card">
              <a class="product-media" [routerLink]="['/dashboard/products', product._id]">
                @if (vm.imageOf(product)) {
                  <img [src]="vm.imageOf(product)" [alt]="product.name" loading="lazy" (error)="vm.hideBrokenImage($event)" />
                } @else {
                  <span class="media-fallback"><mat-icon aria-hidden="true">inventory_2</mat-icon></span>
                }
                @if (vm.hasVideo(product)) {
                  <span class="video-pill"><mat-icon aria-hidden="true">play_circle</mat-icon></span>
                }
              </a>
              <a class="product-copy" [routerLink]="['/dashboard/products', product._id]">
                <small>{{ vm.categoryOf(product).label }}</small>
                <strong>{{ product.name }}</strong>
                <span class="product-summary">{{ vm.summaryOf(product) }}</span>
              </a>
              <div class="product-foot">
                <span class="price">
                  @if (vm.priced(product)) {
                    {{ vm.priceOf(product) | currency:'₦':'symbol':'1.0-0' }}
                  } @else {
                    Price on request
                  }
                </span>
                <span class="stock" [class.is-out]="vm.outOfStock(product)">{{ vm.stockOf(product).label }}</span>
              </div>
              <button
                mat-flat-button
                color="primary"
                type="button"
                class="add-btn"
                [disabled]="vm.outOfStock(product) || !vm.priced(product)"
                (click)="vm.addToCart(product, $event)"
              >
                <mat-icon aria-hidden="true">add_shopping_cart</mat-icon>
                {{ vm.quantityInCart(product) > 0 ? 'Add another' : 'Add to cart' }}
              </button>
            </article>
          }
        </div>

        @if (vm.hasMore()) {
          <button mat-stroked-button type="button" class="load-more" (click)="vm.loadMore()" [disabled]="vm.loadingMore()">
            {{ vm.loadingMore() ? 'Loading more…' : 'Load more products' }}
          </button>
        }
      }

      <div mobileFooter>
        <async-mobile-sticky-action ariaLabel="Cart" [aboveBottomNav]="true">
          <button mat-flat-button color="primary" type="button" class="checkout-btn" [disabled]="vm.cartCount() === 0" (click)="vm.goToCheckout()">
            <mat-icon>shopping_bag</mat-icon>
            {{ vm.cartCount() === 0 ? 'Cart is empty' : 'Review cart · ' + vm.cartCount() + ' · ' + (vm.cartTotal() | currency:'₦':'symbol':'1.0-0') }}
          </button>
        </async-mobile-sticky-action>
      </div>
    </async-mobile-page-shell>
  `,
  styles: [`
    .catalog-hero {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: var(--ms-radius-xl);
      background: linear-gradient(125deg, #121024, #24204b 58%, #3f4bb8);
      color: #fff;
      box-shadow: var(--ms-shadow-glow);
    }
    .catalog-hero .eyebrow { margin: 0 0 4px; color: rgba(255,255,255,0.7); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .catalog-hero h1 { margin: 0; font-size: 1.35rem; letter-spacing: -0.03em; }
    .catalog-hero p { margin: 4px 0 0; color: rgba(255,255,255,0.72); font-size: 0.74rem; line-height: 1.4; }
    .cart-chip { display: flex; flex-direction: column; align-items: center; gap: 1px; flex: none; min-width: 76px; padding: 8px; border-radius: var(--ms-radius-lg); background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); }
    .cart-chip mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .cart-chip strong { font-size: 1.1rem; line-height: 1; }
    .cart-chip span, .cart-chip small { font-size: 0.62rem; color: rgba(255,255,255,0.75); }

    .controls { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
    .category-tabs { margin-bottom: 10px; }

    .results-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin: 8px 0; }
    .results-head .eyebrow { margin: 0 0 2px; color: var(--ms-primary-strong); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .results-head h2 { margin: 0; font-size: 0.98rem; letter-spacing: -0.02em; }
    .results-head > span { color: var(--ms-text-muted); font-size: 0.68rem; }

    .product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .product-card { display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); overflow: hidden; }
    .product-media { position: relative; display: block; aspect-ratio: 1 / 1; background: var(--ms-surface-3); overflow: hidden; }
    .product-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media-fallback { display: grid; width: 100%; height: 100%; place-items: center; color: var(--ms-text-muted); }
    .video-pill { position: absolute; right: 6px; bottom: 6px; display: inline-grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; background: rgba(9,9,11,0.72); color: #fff; }
    .video-pill mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .product-copy { display: flex; flex-direction: column; gap: 1px; padding: 8px 8px 0; color: inherit; text-decoration: none; }
    .product-copy small { color: var(--ms-primary-strong); font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .product-copy strong { overflow: hidden; font-size: 0.78rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .product-summary { overflow: hidden; color: var(--ms-text-muted); font-size: 0.62rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .product-foot { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 6px 8px; margin-top: auto; }
    .price { font-size: 0.76rem; font-weight: 750; font-variant-numeric: tabular-nums; }
    .stock { color: var(--ms-success); font-size: 0.58rem; font-weight: 650; }
    .stock.is-out { color: var(--ms-error); }
    .add-btn { min-height: 44px; margin: 0 8px 8px; font-size: 0.68rem; }
    .add-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; }
    .load-more { width: 100%; min-height: 44px; margin-top: 10px; }

    .state-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); background: var(--ms-surface); text-align: center; }
    .state-card > mat-icon { color: var(--ms-primary-strong); font-size: 34px; width: 34px; height: 34px; }
    .state-card strong { font-size: 0.92rem; }
    .state-card p { margin: 0; color: var(--ms-text-muted); font-size: 0.76rem; line-height: 1.45; }
    .state-card a, .state-card button { min-height: 44px; margin-top: 4px; }

    .checkout-btn { width: 100%; min-height: 48px; }
    .checkout-btn mat-icon { margin-right: 6px; }

    @media (min-width: 600px) {
      .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .controls { flex-direction: row; }
      .controls mat-form-field { flex: 1; }
    }
    @media (min-width: 900px) {
      .product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  `],
})
export class ProductCatalogMobileComponent {
  protected readonly vm = inject(ProductCatalogFacade);

  protected readonly categoryTabs = computed<MobileTab[]>(() => (
    this.vm.categories().map((category) => ({
      id: category.key,
      label: category.label,
      badge: category.count,
    }))
  ));
}
