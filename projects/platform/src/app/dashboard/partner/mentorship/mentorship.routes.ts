import { Routes } from '@angular/router';
import { CreateTeamIndexComponent } from './team/create-team/index.component';
import { ManageTeamIndexComponent } from './team/manage-team/index.component';
import { MyPartnersIndexComponent } from './my-partners/index.component';
import { TeamSupportIndexComponent } from './team/manage-team/support/index.component';
import { EditTeamIndexComponent } from './team/edit-team/index.component';
import { MyPartnerSupportIndexComponent } from './my-partners/support/index.component';
import { MyPartnersContactsIndexComponent } from './my-partners/contacts/index.component';
import { MyPartnerContactDetailIndexComponent } from './my-partners/contacts/details/index.component';

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
                    component: CreateTeamIndexComponent,
                    title: "Start a Team - Organize a purpose team",
                },
                  {
                      path: 'members',
                      component: ManageTeamIndexComponent,
                      title: "My Teams - Purpose teams you created",
                  },
                  {
                      path: 'activation',
                      loadComponent: () => import('./team/activation-board/index.component').then(r => r.ActivationBoardIndexComponent),
                      title: "Activation Board - Who needs you next",
                  },
                 {
                     path: 'confirmations',
                     redirectTo: '/dashboard/team',
                     pathMatch: 'full',
                 },

                {
                    path: 'member/:id',
                    component: TeamSupportIndexComponent,
                    title: "Team Support - Manage team members from partners",
                },  

                {
                    path: 'detail/:id',
                    component: EditTeamIndexComponent,
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
                            component: MyPartnersIndexComponent,
                            title: "My Partners - Your direct partners",
                        },
                        {
                            path: 'contacts/:id',
                            component: MyPartnersContactsIndexComponent,
                            title: "Partner Support - View details & support partner",
                        }, 
                        {
                            path: 'contact-detail/:id',
                            component: MyPartnerContactDetailIndexComponent,
                            title: "Partner Prospect Details - View and manage your partner prospect details",
                        },
                        {
                            path: 'detail/:id',
                            component: MyPartnerSupportIndexComponent,
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