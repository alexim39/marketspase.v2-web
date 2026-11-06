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
                title: "Join MarketSpase - Partner business"
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
                        title: "Partner Signin - MarketSpase Partner Sign in",
                    },
                    {
                        path: 'signup',
                        component: PartnerSignupComponent,
                        title: "Partner Signup - MarketSpase Partner Sign up"
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