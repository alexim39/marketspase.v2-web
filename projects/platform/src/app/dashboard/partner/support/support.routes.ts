import { Routes } from '@angular/router';
import { SubmitTicketContainerComponent } from './submit-ticket/submit-ticket-container.component';
import { AboutAppContainerComponent } from './about-app/about-app-container.component';

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
            component: SubmitTicketContainerComponent,
            title: "Submit a Ticket - Reach out to administrator for support and feedback",
        },  
             
       /*  {
            path: 'app',
            component: AboutAppContainerComponent,
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
              component: AboutAppContainerComponent,
              title: "About MarketSpase App - Know about Application",
            },  
          ]
        }
    ],
  },
];