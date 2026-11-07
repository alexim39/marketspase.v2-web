import { Routes } from "@angular/router";
import { IndexComponent } from "./index.component";
import { PartnerSigninComponent } from "../auth/signin/partner-signin.component";
import { PartnerSignupComponent } from "../auth/signup/partner-signup.component";
import { IndexBodyComponent } from "./index-body.component";
import { PartnerForgotPasswordComponent } from "../auth/forgot-password/partner-forgot-password.component";
import { PartnerResetPasswordComponent } from "../auth/reset-password/partner-reset-password.component";

export const IndexRoutes: Routes = [
    {
        path: '',
        component: IndexComponent,
        children: [
            {
                path: '',
                component: IndexBodyComponent
            },
            {
                path: 'join',
                loadComponent: () => import('./join/join-landing.component').then(c => c.JoinLandingComponent),
                title: "Join MarketSpase - Start Your Online Business Without the Chase"
            },
            {
                path: 'how-it-works',
                loadComponent: () => import('./how-it-works/how-it-works.component').then(c => c.HowItWorksComponent),
                title: "How Your Online Business Works - MarketSpase"
            },
            {
                path: 'ora',
                loadComponent: () => import('./ora/ora-page.component').then(c => c.OraPublicPageComponent),
                title: "Meet Ora - Your AI Business Partner | MarketSpase"
            },
            {
                path: 'about',
                loadComponent: () => import('./about/about-page.component').then(c => c.AboutPageComponent),
                title: "About MarketSpase - A Real Online Business Opportunity"
            },
            {
                path: 'faq',
                loadComponent: () => import('./faq-page/faq-page.component').then(c => c.FaqPageComponent),
                title: "Online Business Questions - MarketSpase FAQ"
            },
            {
                path: 'partner',
                children: [
                    {
                        path: '',
                        redirectTo: 'signin',
                        pathMatch: 'full'
                    },
                    {
                        path: 'signin',
                        component: PartnerSigninComponent,
                        title: "Sign In - MarketSpase Partner Platform",
                    },
                    {
                        path: 'signup',
                        component: PartnerSignupComponent,
                        title: "Create Your Free Account - MarketSpase"
                    },
                    {
                        path: 'verify-email',
                        loadComponent: () => import('../auth/verify-email/partner-verify-email.component').then(c => c.PartnerVerifyEmailComponent),
                        title: "Verify Email - MarketSpase"
                    },
                    {
                        path: 'forgot-password',
                        component: PartnerForgotPasswordComponent,
                        title: "Forgot Password - Partner reset password"
                    },
                    {
                        path: 'reset-password',
                        component: PartnerResetPasswordComponent,
                        title: "Reset Password - Choose a new password"
                    },
                ]
            },
           
           
        ]
    }
];