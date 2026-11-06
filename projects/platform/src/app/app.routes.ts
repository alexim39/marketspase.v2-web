import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found.component';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./index/index.routes').then(r => r.IndexRoutes) },
  { path: 'dashboard', loadChildren: () => import('./dashboard/partner/dashboard.routes').then(r => r.dashboardRoutes) },

  // should be the last path on routes
  {path: '**', component: PageNotFoundComponent}

];
