import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found.component';
import { StoreHomeComponent } from './store/home/store-home.component';
import { StoreDirectoryComponent } from './store/directory/store-directory.component';
import { StorefrontComponent } from './store/front/storefront.component';
import { StoreProductComponent } from './store/product/store-product.component';
import { StoreSupportComponent } from './store/support/store-support.component';
import { StoreCartComponent } from './store/cart/cart.component';
import { StoreCheckoutComponent } from './store/checkout/checkout.component';
import { StoreCheckoutResultComponent } from './store/checkout/checkout-result.component';

export const routes: Routes = [
  {
    path: '',
    component: StoreHomeComponent,
    title: 'MarketSpase Store | Shop independent partner stores',
  },
  {
    path: 'stores',
    component: StoreDirectoryComponent,
    title: 'Find a store | MarketSpase Store',
  },
  {
    path: 'support',
    component: StoreSupportComponent,
    title: 'Support | MarketSpase Store',
  },
  {
    path: 'cart',
    component: StoreCartComponent,
    title: 'Your cart | MarketSpase Store',
  },
  {
    path: 'checkout/result',
    component: StoreCheckoutResultComponent,
    title: 'Payment result | MarketSpase Store',
  },
  {
    path: 'checkout',
    component: StoreCheckoutComponent,
    title: 'Checkout | MarketSpase Store',
  },
  {
    path: 'legal',
    loadChildren: () => import('./legal/legal-routes').then((r) => r.legalRoutes),
  },

  // Retire the Diamond Project acquisition routes.
  { path: 'get-started', redirectTo: '', pathMatch: 'full' },
  { path: 'faq', redirectTo: 'support', pathMatch: 'full' },
  { path: 'contact', redirectTo: 'support', pathMatch: 'full' },
  { path: 'events', redirectTo: '', pathMatch: 'full' },

  {
    path: ':username/product/:productId',
    component: StoreProductComponent,
    title: 'Product | MarketSpase Store',
  },
  {
    path: ':username',
    component: StorefrontComponent,
    title: 'Partner store | MarketSpase Store',
  },

  { path: '**', component: PageNotFoundComponent, title: 'Page not found | MarketSpase Store' },
];
