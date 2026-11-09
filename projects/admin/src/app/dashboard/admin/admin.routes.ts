import { Routes } from '@angular/router';
import { ManageRolesComponent } from './roles/roles.component';
import { AdminAutomationComponent } from './automation/job-health.component';
import { AdminDepositsComponent } from './deposits/admin-deposits.component';
import { AdminPartnerPipelineComponent } from './partner-pipeline/admin-partner-pipeline.component';
import { AdminPagesComponent } from './pages/admin-pages.component';
import { AdminOrdersComponent } from './orders/admin-orders.component';
import { AdminTrainingQuizzesComponent } from './training-quizzes/admin-training-quizzes.component';
import { AdminAuditComponent } from './audit/admin-audit.component';
import { AdminTicketsComponent } from './tickets/admin-tickets.component';
import { AdminModerationComponent } from './moderation/admin-moderation.component';
import { AdminBroadcastComponent } from './broadcast/admin-broadcast.component';
import { AdminSubscriptionsComponent } from './subscriptions/admin-subscriptions.component';
import { AdminBonusesComponent } from './bonuses/admin-bonuses.component';
import { AdminTutorialsComponent } from './tutorials/admin-tutorials.component';
import { AdminProductsComponent } from './products/admin-products.component';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { AdminStoresComponent } from './stores/admin-stores.component';
import { AdminStoreOrdersComponent } from './store-orders/admin-store-orders.component';
import { AdminStoreSettlementsComponent } from './store-settlements/admin-store-settlements.component';
import { AdminSettingsComponent } from './settings/admin-settings.component';
import { AdminMemberViewComponent } from './members/admin-member-view.component';
import { AdminRecycleBinComponent } from './recycle-bin/admin-recycle-bin.component';

/**
 * Admin feature routes. The shell and admin role guard live in the root
 * app routes; these paths are relative to the admin root.
 */
export const AdminRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: AdminDashboardComponent, title: 'Command centre - MarketSpase Admin' },
  {
    path: 'roles',
    component: ManageRolesComponent,
    title: 'Manage roles - MarketSpase Admin',
  },
  {
    path: 'members/:id',
    component: AdminMemberViewComponent,
    title: 'Member 360 - MarketSpase Admin',
  },
  { path: 'campaigns', redirectTo: 'growth', pathMatch: 'full' },
  { path: 'reported-leads', redirectTo: 'growth', pathMatch: 'full' },
  {
    path: 'automation',
    component: AdminAutomationComponent,
    title: 'Automation - MarketSpase Admin',
  },
  {
    path: 'deposits',
    component: AdminDepositsComponent,
    title: 'Manual deposits - MarketSpase Admin',
  },
  { path: 'leads', redirectTo: 'partner-pipeline', pathMatch: 'full' },
  {
    path: 'partner-pipeline',
    component: AdminPartnerPipelineComponent,
    title: 'Partner pipeline - MarketSpase Admin',
  },
  {
    path: 'pages',
    component: AdminPagesComponent,
    title: 'Public pages - MarketSpase Admin',
  },
  { path: 'prolific-woman-leads', redirectTo: 'growth', pathMatch: 'full' },
  { path: 'reservations', redirectTo: 'growth', pathMatch: 'full' },
  {
    path: 'orders',
    component: AdminOrdersComponent,
    title: 'Product orders - MarketSpase Admin',
  },
  {
    path: 'stores',
    component: AdminStoresComponent,
    title: 'Partner stores - MarketSpase Admin',
  },
  {
    path: 'store-orders',
    component: AdminStoreOrdersComponent,
    title: 'Store orders - MarketSpase Admin',
  },
  {
    path: 'store-settlements',
    component: AdminStoreSettlementsComponent,
    title: 'Escrow and settlements - MarketSpase Admin',
  },
  {
    path: 'activation',
    loadComponent: () => import('./activation/admin-activation.component').then((r) => r.AdminActivationComponent),
    title: 'Partner activation - MarketSpase Admin',
  },
  {
    path: 'growth',
    loadComponent: () => import('./growth/admin-growth.component').then((r) => r.AdminGrowthComponent),
    title: 'Growth campaigns - MarketSpase Admin',
  },
  {
    path: 'compensation',
    loadComponent: () => import('./compensation/admin-compensation.component').then((r) => r.AdminCompensationComponent),
    title: 'Compensation - MarketSpase Admin',
  },
  {
    path: 'training-quizzes',
    component: AdminTrainingQuizzesComponent,
    title: 'Training quizzes - MarketSpase Admin',
  },
  {
    path: 'audit',
    component: AdminAuditComponent,
    title: 'Audit log - MarketSpase Admin',
  },
  {
    path: 'recycle-bin',
    component: AdminRecycleBinComponent,
    title: 'Recycle bin - MarketSpase Admin',
  },
  {
    path: 'tickets',
    component: AdminTicketsComponent,
    title: 'Support tickets - MarketSpase Admin',
  },
  {
    path: 'moderation',
    component: AdminModerationComponent,
    title: 'Moderation - MarketSpase Admin',
  },
  {
    path: 'rank-groups',
    loadComponent: () => import('./rank-groups/admin-rank-groups.component').then((r) => r.AdminRankGroupsComponent),
    title: 'Rank groups - MarketSpase Admin',
  },
  {
    path: 'rank-groups/:rank',
    loadComponent: () => import('./rank-groups/admin-rank-group-detail.component').then((r) => r.AdminRankGroupDetailComponent),
    title: 'Rank group - MarketSpase Admin',
  },
  {
    path: 'broadcast',
    component: AdminBroadcastComponent,
    title: 'Broadcast - MarketSpase Admin',
  },
  {
    path: 'subscriptions',
    component: AdminSubscriptionsComponent,
    title: 'Email list - MarketSpase Admin',
  },
  {
    path: 'bonuses',
    component: AdminBonusesComponent,
    title: 'Bonuses - MarketSpase Admin',
  },
  { path: 'kits', redirectTo: 'tutorials', pathMatch: 'full' },
  {
    path: 'tutorials',
    component: AdminTutorialsComponent,
    title: 'Tutorials - MarketSpase Admin',
  },
  {
    path: 'settings',
    component: AdminSettingsComponent,
    title: 'Platform settings - MarketSpase Admin',
  },
  { path: 'oversight', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'products',
    component: AdminProductsComponent,
    title: 'Products - MarketSpase Admin',
  },
];
