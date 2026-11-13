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
        {
            path: 'appearance',
            loadComponent: () => import('./appearance/appearance.component').then(m => m.AppearanceSettingsComponent),
            title: "Appearance Settings - Light, dark or system theme",
        },
        {
            path: 'verification',
            loadComponent: () => import('./verification/verification.component').then(m => m.VerificationComponent),
            title: "Verification & KYC - Identity status",
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
            path: 'trust',
            loadComponent: () => import('./trust/trust-centre.component').then(m => m.TrustCentreComponent),
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