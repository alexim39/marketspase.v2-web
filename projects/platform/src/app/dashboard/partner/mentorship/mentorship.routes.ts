import { Routes } from '@angular/router';
import { CreateTeamContainerComponent } from './team/create-team/create-team-container.component';
import { ManageTeamContainerComponent } from './team/manage-team/manage-team-container.component';
import { MyPartnersContainerComponent } from './my-partners/my-partners-container.component';
import { TeamSupportContainerComponent } from './team/manage-team/support/support-container.component';
import { EditTeamContainerComponent } from './team/edit-team/edit-team-container.component';
import { MyPartnerSupportContainerComponent } from './my-partners/support/support-container.component';
import { MyPartnersContactsContainerComponent } from './my-partners/contacts/contacts-container.component';
import { MyPartnerContactsDetailContainerComponent } from './my-partners/contacts/details/contacts-detail-container.component';

export const MentorshipRoutes: Routes = [
  {
    path: '',
    redirectTo: 'team/members',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
        {
            path: 'team',
            children: [
                {
                    path: 'new',
                    component: CreateTeamContainerComponent,
                    title: "Start a Team - Organize a purpose team",
                },
                  {
                      path: 'members',
                      component: ManageTeamContainerComponent,
                      title: "My Teams - Purpose teams you created",
                  },
                  {
                      path: 'activation',
                      loadComponent: () => import('./team/activation-board/activation-board.component').then(r => r.ActivationBoardComponent),
                      title: "Activation Board - Who needs you next",
                  },
                 {
                     path: 'confirmations',
                     redirectTo: '/dashboard/team',
                     pathMatch: 'full',
                 },

                {
                    path: 'member/:id',
                    component: TeamSupportContainerComponent,
                    title: "Team Support - Manage team members from partners",
                },  

                {
                    path: 'detail/:id',
                    component: EditTeamContainerComponent,
                    title: "Edit Team Details",
                },   
            ]
            
        },  
        {
            path: 'partners',
            children: [
                {
                    path: 'my-partners',
                    children: [
                        {
                            path: '',
                            component: MyPartnersContainerComponent,
                            title: "My Partners - Your direct partners",
                        },
                        {
                            path: 'contacts/:id',
                            component: MyPartnersContactsContainerComponent,
                            title: "Partner Support - View details & support partner",
                        }, 
                        {
                            path: 'contact-detail/:id',
                            component: MyPartnerContactsDetailContainerComponent,
                            title: "Partner Prospect Details - View and manage your partner prospect details",
                        },
                        {
                            path: 'detail/:id',
                            component: MyPartnerSupportContainerComponent,
                            title: "My Partners Support - Manage partners listing",
                        },
                        {
                            path: 'my-codes',
                            redirectTo: '/dashboard/mentorship/partners/my-partners',
                            pathMatch: 'full',
                        },
                    ]
                },    
            ]
            
        },  
       
        
    ],
  },
];