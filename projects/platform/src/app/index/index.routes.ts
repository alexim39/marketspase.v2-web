import { Routes } from "@angular/router";
import { IndexComponent } from "./index.component";
import { PartnerSigninIndexComponent } from "../auth/signin/index.component";
import { PartnerSignupIndexComponent } from "../auth/signup/index.component";
import { LandingIndexComponent } from "./home/index.component";
import { PartnerForgotPasswordIndexComponent } from "../auth/forgot-password/index.component";
import { PartnerResetPasswordIndexComponent } from "../auth/reset-password/index.component";
import { PartnerVerifyEmailIndexComponent } from "../auth/verify-email/index.component";
import { JoinLandingIndexComponent } from "./join/index.component";
import { HowItWorksIndexComponent } from "./how-it-works/index.component";
import { OraPublicPageIndexComponent } from "./ora/index.component";
import { AboutPageIndexComponent } from "./about/index.component";
import { FaqPageIndexComponent } from "./faq-page/index.component";

export const IndexRoutes: Routes = [
    {
        path: '',
        component: IndexComponent,
        children: [
            {
                path: '',
                component: LandingIndexComponent
            },
            {
                path: 'join',
                component: JoinLandingIndexComponent,
                title: "Join MarketSpase - Start Your Online Business Without the Chase"
            },
            {
                path: 'how-it-works',
                component: HowItWorksIndexComponent,
                title: "How Your Online Business Works - MarketSpase"
            },
            {
                path: 'ora',
                component: OraPublicPageIndexComponent,
                title: "Meet Ora - Your AI Business Partner | MarketSpase"
            },
            {
                path: 'about',
                component: AboutPageIndexComponent,
                title: "About MarketSpase - A Real Online Business Opportunity"
            },
            {
                path: 'faq',
                component: FaqPageIndexComponent,
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
                        component: PartnerSigninIndexComponent,
                        title: "Sign In - MarketSpase Partner Platform",
                    },
                    {
                        path: 'signup',
                        component: PartnerSignupIndexComponent,
                        title: "Create Your Free Account - MarketSpase"
                    },
                    {
                        path: 'verify-email',
                        component: PartnerVerifyEmailIndexComponent,
                        title: "Verify Email - MarketSpase"
                    },
                    {
                        path: 'forgot-password',
                        component: PartnerForgotPasswordIndexComponent,
                        title: "Forgot Password - Partner reset password"
                    },
                    {
                        path: 'reset-password',
                        component: PartnerResetPasswordIndexComponent,
                        title: "Reset Password - Choose a new password"
                    },
                ]
            },
           
           
        ]
    }
];