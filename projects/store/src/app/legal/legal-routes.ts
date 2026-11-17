import { Routes } from "@angular/router";
import { LegalIndexComponent } from './index.component';
import { TermsIndexComponent } from './terms/index.component';
import { PrivacyIndexComponent } from './privacy/index.component';
import { CookiesIndexComponent } from './cookies/index.component';

export const legalRoutes: Routes = [
    { 
        path: '', 
        //component: IndexComponent, 

        children: [
            { path: '',
                component: LegalIndexComponent,
                title: "MarketSpase Store Legal - Terms and conditions of website use",
                children: [
                    { path: 'cookies', 
                        component: CookiesIndexComponent, 
                        title: "Legal - Cookies terms of use"
                    },
                    { path: 'terms', 
                        component: TermsIndexComponent, 
                        title: "Legal - Terms of use"
                    },
                    { path: 'privacy',
                        component: PrivacyIndexComponent,
                        title: "Legal - Privacy terms of use"
                    },
                    { path: '', pathMatch: 'full', redirectTo: 'terms' },
                    { path: '**', redirectTo: 'terms' },
                ]
            },
           

        ]
    },

]

