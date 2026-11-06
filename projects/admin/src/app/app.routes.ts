import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/role.guard';
import { AdminShellComponent } from './layout/admin-shell/admin-shell.component';

export const routes: Routes = [
  {
    path: 'signin',
    loadComponent: () => import('./auth/signin/signin.component').then((m) => m.AdminSigninComponent),
    title: 'Admin sign in | MarketSpase',
  },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./dashboard/admin/admin.routes').then((m) => m.AdminRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
