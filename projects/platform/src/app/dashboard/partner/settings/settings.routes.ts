import { Routes } from '@angular/router';
import { ProfileMrgContainerIndexComponent } from './profile-mgr/index.component';
import { LandingPageSettingContainerIndexComponent } from './Landing-page/index.component';
import { BillingContainerIndexComponent } from '../billing/index.component';

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
            component: ProfileMrgContainerIndexComponent,
            title: "Partner Profile Setting - Configure your profile settings",
        },
        {
            path: 'appearance',
            loadComponent: () => import('./appearance/index.component').then(m => m.AppearanceSettingsIndexComponent),
            title: "Appearance Settings - Light, dark or system theme",
        },
        {
            path: 'verification',
            loadComponent: () => import('./verification/index.component').then(m => m.VerificationIndexComponent),
            title: "Verification & KYC - Identity status",
        },
        { path: 'landing-page', 
            component: LandingPageSettingContainerIndexComponent,
            title: "Landing Page Settings - Set what prospect sees on your landing page",
        },
        {
            path: 'billing',
            component: BillingContainerIndexComponent,
            title: "Billing Settings - Manage your billing information",
        },
        {
            path: 'trust',
            loadComponent: () => import('./trust/index.component').then(m => m.TrustCentreIndexComponent),
            title: "Trust & Compliance - Identity, consent, records and data",
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