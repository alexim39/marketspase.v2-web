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
    loadComponent: () => import('./catalog/product-catalog.component').then((r) => r.ProductCatalogComponent),
    title: 'Products - Shop for use or resale',
  },
  {
    path: 'eshop',
    redirectTo: '/dashboard/products',
    pathMatch: 'full',
  },
  {
    path: 'my-store',
    loadComponent: () => import('./my-store/my-store.component').then((r) => r.MyStoreComponent),
    title: 'My store - Publish and manage your public shop',
  },
  {
    path: 'store-orders',
    loadComponent: () => import('./store-orders/store-orders.component').then((r) => r.StoreOrdersComponent),
    title: 'Store orders - Fulfil customer orders',
  },
  {
    path: 'order-history',
    loadComponent: () => import('./purchases/purchases-container.component').then((r) => r.PurchaseContainerComponent),
    title: 'My orders - Track and reorder products',
  },
  {
    path: 'guides',
    loadComponent: () => import('./guides/product-guides.component').then((r) => r.ProductGuidesComponent),
    title: 'Product guides - Buying, delivery and support',
  },
  {
    path: 'resell',
    loadComponent: () => import('./resale/resale-hub.component').then((r) => r.ResaleHubComponent),
    title: 'Resell - Partner pricing and margin',
  },
  {
    path: ':id',
    loadComponent: () => import('./product-page/product-page.component').then((r) => r.ProductPageComponent),
    title: 'Product details - MarketSpase',
  },
];
