import { Routes } from "@angular/router";
import { HomeIndexComponent } from "../home/index.component";
import { authGuard } from "../../core/auth/auth.guard";

export const dashboardRoutes: Routes = [
    {
        path: '',
        loadComponent: () => import('../shell/app-shell.component').then(m => m.AppShellComponent),
        canActivate: [authGuard],
        children: [
            {
                path: '',
                component: HomeIndexComponent,
                title: "Dashboard - Your business command center",
            },
            {
                path: 'activate',
                loadComponent: () => import('../activation/index.component').then(r => r.ActivationIndexComponent),
                title: "Activate your partner account",
            },
            {
                path: 'path',
                loadComponent: () => import('./launch-path/index.component').then(r => r.LaunchPathIndexComponent),
                title: "My Launch Path - From signup to first commission",
            },
            {
                path: 'campaigns',
                loadComponent: () => import('../campaigns/index.component').then(r => r.CampaignsIndexComponent),
                title: "Partner acquisition - Fund central acquisition",
            },
            {
                path: 'promote',
                pathMatch: 'full',
                loadComponent: () => import('../promote/index.component').then(r => r.PromoteHubIndexComponent),
                title: "Promote - Share your page, content and outreach",
            },
            {
                path: 'compensation',
                loadComponent: () => import('../compensation/index.component').then(r => r.CompensationIndexComponent),
                title: "Compensation - Rank, commissions and mentor bonus",
            },
            { path: 'earnings', redirectTo: 'compensation', pathMatch: 'full' },
            { path: 'tools/campaigns', redirectTo: '/dashboard/campaigns', pathMatch: 'prefix' },
            { path: 'prospects/general-list', redirectTo: 'prospects/pipeline', pathMatch: 'full' },

            { path: 'settings', loadChildren: () => import('./settings/settings.routes').then(r => r.SettingsRoutes) }, 
            { path: 'resources', loadChildren: () => import('./resources/resources.routes').then(r => r.ResourcesRoutes) }, 
            { path: 'mentorship', loadChildren: () => import('./mentorship/mentorship.routes').then(r => r.MentorshipRoutes) }, 
            { path: 'products', loadChildren: () => import('./products/products.routes').then(r => r.ProductsRoutes) }, 
            { path: 'prospects', loadChildren: () => import('./prospects/prospects.routes').then(r => r.ProspectsRoutes) }, 
            { path: 'support', loadChildren: () => import('./support/support.routes').then(r => r.SupportRoutes) }, 
            { path: 'admin', loadComponent: () => import('./admin-moved/admin-moved.component').then(r => r.AdminMovedComponent), title: "Admin console moved - MarketSpase" },
            { path: 'network', loadChildren: () => import('../network/network.routes').then(r => r.NetworkRoutes) }, 
            { path: 'notifications', loadChildren: () => import('../notifications/notifications.routes').then(r => r.NotificationsRoutes) }, 
            { path: 'goals', loadChildren: () => import('../goals/goals.routes').then(r => r.GoalsRoutes) }, 
            { path: 'insights', loadChildren: () => import('../insights/insights.routes').then(r => r.InsightsRoutes) }, 
            { path: 'messages', loadChildren: () => import('../messages/messages.routes').then(r => r.MessagesRoutes) }, 
            { path: 'progress', loadChildren: () => import('../progress/progress.routes').then(r => r.ProgressRoutes) }, 
            { path: 'training', loadChildren: () => import('../training/training.routes').then(r => r.TrainingRoutes) }, 
            { path: 'wallet', loadChildren: () => import('../wallet/wallet.routes').then(r => r.WalletRoutes) }, 
            { path: 'community', loadChildren: () => import('../community/community.routes').then(r => r.CommunityRoutes) },
            { path: 'marketing', redirectTo: 'promote', pathMatch: 'prefix' },
            { path: 'ora', loadChildren: () => import('../ora/ora.routes').then(r => r.OraRoutes) },

            // New IA landing pages
            { path: 'pipeline', loadComponent: () => import('./pipeline/pipeline-hub.component').then(m => m.PipelineHubComponent), title: "Pipeline - Who needs you today" },
            { path: 'team/handoffs', loadComponent: () => import('./mentorship/handoffs/index.component').then(m => m.MentorHandoffsIndexComponent), title: "New member tasks - Mentor onboarding" },
            { path: 'team', loadComponent: () => import('./team/index.component').then(m => m.TeamHubIndexComponent), title: "Team - Who needs you today" },
            { path: 'learn/video-of-the-week', loadComponent: () => import('./learn/weekly-video/index.component').then(m => m.WeeklyVideoIndexComponent), title: "Video of the Week - Weekly briefing" },
            { path: 'learn/video-of-the-week/:id/reflections', loadComponent: () => import('./learn/weekly-video/reflections/index.component').then(m => m.WeeklyVideoReflectionsIndexComponent), title: "Reflections from the team - Weekly briefing" },
            { path: 'learn/video-of-the-week/:id', loadComponent: () => import('./learn/weekly-video/index.component').then(m => m.WeeklyVideoIndexComponent), title: "Video of the Week - Weekly briefing" },
            { path: 'learn', loadComponent: () => import('./learn/index.component').then(m => m.LearnHubIndexComponent), title: "Learn - Your next step is clear" },
            { path: 'more', loadComponent: () => import('./more/index.component').then(m => m.MoreHubIndexComponent), title: "More - Account and utilities" }, 
                
                 
            { path: 'checkout',
                loadComponent: () => import('./products/checkout/index.component').then(r => r.CheckoutIndexComponent),
                title: "Checkout - Pay from your wallet",
            },
        ]
    },
]
