import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found.component';
import { StoreHomeIndexComponent } from './store/home/index.component';
import { StoreDirectoryIndexComponent } from './store/directory/index.component';
import { StorefrontIndexComponent } from './store/front/index.component';
import { StoreProductIndexComponent } from './store/product/index.component';
import { StoreSupportIndexComponent } from './store/support/index.component';
import { StoreCartIndexComponent } from './store/cart/index.component';
import { StoreCheckoutIndexComponent } from './store/checkout/checkout-index.component';
import { StoreCheckoutResultIndexComponent } from './store/checkout/checkout-result-index.component';
import { PersonalLeadPageIndexComponent } from './store/lead-page/index.component';
import { StoreOrderTrackIndexComponent } from './store/order-track/index.component';

export const routes: Routes = [
  {
    path: '',
    component: StoreHomeIndexComponent,
    title: 'MarketSpase Store | Shop independent partner stores',
  },
  {
    path: 'stores',
    component: StoreDirectoryIndexComponent,
    title: 'Find a store | MarketSpase Store',
  },
  {
    path: 'support',
    component: StoreSupportIndexComponent,
    title: 'Support | MarketSpase Store',
  },
  {
    path: 'cart',
    component: StoreCartIndexComponent,
    title: 'Your cart | MarketSpase Store',
  },
  {
    path: 'checkout/result',
    component: StoreCheckoutResultIndexComponent,
    title: 'Payment result | MarketSpase Store',
  },
  {
    path: 'checkout',
    component: StoreCheckoutIndexComponent,
    title: 'Checkout | MarketSpase Store',
  },
  {
    path: 'order/:reference',
    component: StoreOrderTrackIndexComponent,
    title: 'Track order | MarketSpase Store',
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
    path: 'lead/:username',
    component: PersonalLeadPageIndexComponent,
    title: 'Connect | MarketSpase',
  },
  {
    path: ':username/product/:productId',
    component: StoreProductIndexComponent,
    title: 'Product | MarketSpase Store',
  },
  {
    path: ':username',
    component: StorefrontIndexComponent,
    title: 'Partner store | MarketSpase Store',
  },

  { path: '**', component: PageNotFoundComponent, title: 'Page not found | MarketSpase Store' },
];
