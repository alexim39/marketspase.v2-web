import { Routes } from '@angular/router';

/**
 * Products is its own business area: catalog, full product page, orders and
 * guides. Checkout stays at /dashboard/checkout so existing wallet payment
 * and commission accrual keep working.
 */
export const ProductsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./catalog/index.component').then((r) => r.ProductCatalogIndexComponent),
    title: 'Products - Shop for use or resale',
  },
  {
    path: 'eshop',
    redirectTo: '/dashboard/products',
    pathMatch: 'full',
  },
  {
    path: 'my-store',
    loadComponent: () => import('./my-store/index.component').then((r) => r.MyStoreIndexComponent),
    title: 'My store - Publish and manage your public shop',
  },
  {
    path: 'store-orders',
    loadComponent: () => import('./store-orders/index.component').then((r) => r.StoreOrdersIndexComponent),
    title: 'Store orders - Fulfil customer orders',
  },
  {
    path: 'order-history',
    loadComponent: () => import('./purchases/index.component').then((r) => r.PurchasesIndexComponent),
    title: 'My orders - Track and reorder products',
  },
  {
    path: 'guides',
    loadComponent: () => import('./guides/index.component').then((r) => r.ProductGuidesIndexComponent),
    title: 'Product guides - Buying, delivery and support',
  },
  {
    path: 'resell',
    loadComponent: () => import('./resale/index.component').then((r) => r.ResaleHubIndexComponent),
    title: 'Resell - Partner pricing and margin',
  },
  {
    path: ':id',
    loadComponent: () => import('./product-page/index.component').then((r) => r.ProductPageIndexComponent),
    title: 'Product details - MarketSpase',
  },
];
