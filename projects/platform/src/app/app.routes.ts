import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found.component';
import { PublicLeadRedirectComponent } from './index/lead-redirect/public-lead-redirect.component';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./index/index.routes').then(r => r.IndexRoutes) },
  { path: 'dashboard', loadChildren: () => import('./dashboard/partner/dashboard.routes').then(r => r.dashboardRoutes) },

  // Legacy shared lead links belong to the store app; redirect before the wildcard.
  { path: 'lead/:username', component: PublicLeadRedirectComponent, title: 'Opening your MarketSpase page' },

  // should be the last path on routes
  {path: '**', component: PageNotFoundComponent}

];
