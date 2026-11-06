import { Routes } from "@angular/router";
import { HomeComponent } from "../home/home.component";
import { authGuard } from "../../core/auth/auth.guard";

export const dashboardRoutes: Routes = [
    {
        path: '',
        loadComponent: () => import('../shell/app-shell.component').then(m => m.AppShellComponent),
        canActivate: [authGuard],
        children: [
            {
                path: '',
                component: HomeComponent,
                title: "Dashboard - Your business command center",
            },
            {
                path: 'activate',
                loadComponent: () => import('../activation/activation.component').then(r => r.ActivationComponent),
                title: "Activate your partner account",
            },
            {
                path: 'campaigns',
                loadComponent: () => import('../campaigns/campaigns.component').then(r => r.CampaignsComponent),
                title: "Partner acquisition - Fund central acquisition",
            },
            {
                path: 'promote/outreach',
                loadComponent: () => import('../promote/outreach/outreach-hub.component').then(r => r.OutreachHubComponent),
                title: "Outreach - SMS and email tools",
            },
            { path: 'promote/page', redirectTo: '/dashboard/settings/landing-page', pathMatch: 'full' },
            { path: 'promote/content', redirectTo: '/dashboard/resources/ads-contents', pathMatch: 'full' },
            { path: 'promote/guides', redirectTo: '/dashboard/resources/prospecting-contents', pathMatch: 'full' },
            {
                path: 'promote',
                pathMatch: 'full',
                loadComponent: () => import('../promote/promote-hub.component').then(r => r.PromoteHubComponent),
                title: "Promote - Share your page, content and outreach",
            },
            {
                path: 'compensation',
                loadComponent: () => import('../compensation/compensation.component').then(r => r.CompensationComponent),
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
            { path: 'tools', loadChildren: () => import('./tools/tools.routes').then(r => r.ToolsRoutes) }, 
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
            { path: 'team', loadComponent: () => import('./team/team-hub.component').then(m => m.TeamHubComponent), title: "Team - Who needs you today" },
            { path: 'learn', loadComponent: () => import('./learn/learn-hub.component').then(m => m.LearnHubComponent), title: "Learn - Your next step is clear" },
            { path: 'more', loadComponent: () => import('./more/more-hub.component').then(m => m.MoreHubComponent), title: "More - Account and utilities" }, 
                
                 
            {
                path: 'cell-meeting',
                loadComponent: () => import('./mentorship/cell-meeting/cell-meeting-container.component').then(r => r.CellMettingContainerComponent),
                title: "Cell Meetings Mentorship",
            },


            { path: 'checkout',
                loadComponent: () => import('./products/checkout/checkout.component').then(r => r.CheckoutComponent),
                title: "Checkout - Pay from your wallet",
            },
        ]
    },
]
