import { Routes } from '@angular/router';
import { SubmitTicketContainerIndexComponent } from './submit-ticket/index.component';
import { AboutAppContainerIndexComponent } from './about-app/index.component';

export const SupportRoutes: Routes = [
  {
    path: '',
    redirectTo: 'ticket',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
             
        {
            path: 'ticket',
            component: SubmitTicketContainerIndexComponent,
            title: "Submit a Ticket - Reach out to administrator for support and feedback",
        },  
             
       /*  {
            path: 'app',
            component: AboutAppContainerIndexComponent,
            title: "About MarketSpase App - Know about Application",
        },  */ 
         {
          path: 'about',
          children: [
                  
            {
              path: '',
              redirectTo: 'app',
              pathMatch: 'full',
            },  
             {
              path: 'app',
              component: AboutAppContainerIndexComponent,
              title: "About MarketSpase App - Know about Application",
            },  
          ]
        }
    ],
  },
];