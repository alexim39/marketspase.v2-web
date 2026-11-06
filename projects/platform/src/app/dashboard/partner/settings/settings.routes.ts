import { Routes } from '@angular/router';
import { ProfileMrgContainerComponent } from './profile-mgr/profile-mgr-container.component';
import { LandingPageSettingContainerComponent } from './Landing-page/Landing-page-container.component';
import { BillingContainerComponent } from '../billing/billing-container.component';

export const SettingsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'profiles',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
        {
            path: 'profiles',
            component: ProfileMrgContainerComponent,
            title: "Partner Profile Setting - Configure your profile settings",
        }, 
        { path: 'landing-page', 
            component: LandingPageSettingContainerComponent,
            title: "Landing Page Settings - Set what prospect sees on your landing page",
        },
        {
            path: 'billing',
            component: BillingContainerComponent,
            title: "Billing Settings - Manage your billing information",
        },
        {
            path: 'billing/commissions',
            redirectTo: '/dashboard/compensation',
            pathMatch: 'full',
        }, 
        {
            // Legacy admin-style list retired — the Notification Center is
            // the single standard surface (bookmarks keep working).
            path: 'notifications',
            redirectTo: '/dashboard/notifications/center',
            pathMatch: 'full',
        }, 
    ],
  },
];