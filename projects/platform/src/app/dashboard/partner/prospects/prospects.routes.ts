import { Routes } from '@angular/router';
import { MyProspectListContainerComponent } from './personal-prospect-list/personal-prospect-list-container.component';
import { ProspectBookingContainerComponent } from './prospect-booking/prospect-booking-container.component';
import { LeadPipelineComponent } from './lead-pipeline/lead-pipeline.component';
import { PipelineBoardComponent } from './pipeline-board/board.component';
import { RemindersComponent } from './reminders/reminders.component';
import { ProspectDetailComponent } from './prospect-detail/detail.component';
import { EditContactsContainerComponent } from '../contacts/edit/edit-contacts-container.component';
import { BookSessionContainerComponent } from '../contacts/book-session/book-session-container.component';
import { KitsComponent } from './kits/kits.component';

export const ProspectsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'pipeline',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
        {
            path: 'bookings',
            component: ProspectBookingContainerComponent,
            title: "General Prospects Bookings - View all bookings",
        },
        {
            // My Page Leads — private inbox for leads submitted via this
            // partner's public page (/:partnerUsername).
            path: 'personal-list',
            component: MyProspectListContainerComponent,
            title: "My Page Leads - Leads from your public page",
        },
        {
            path: 'pipeline',
            component: LeadPipelineComponent,
            title: "Lead Pipeline - Track prospects through to conversion",
        },
        {
            path: 'kits',
            component: KitsComponent,
            title: "Presentations - One canonical deck per selling moment",
        },
        {
            path: 'kits/:kitId/present',
            loadComponent: () => import('./kits/present/present.component').then((m) => m.PresentComponent),
            title: "Present - Walk a prospect through the deck",
        },
        {
            path: 'reminders',
            component: RemindersComponent,
            title: "Reminders - Follow-up commitments due",
        },
        {
            path: 'board',
            component: PipelineBoardComponent,
            title: "Pipeline Board - Drag and drop your deals",
        },
        {
            path: 'detail/:id',
            component: ProspectDetailComponent,
            title: "Prospect Details - Timeline, activities and conversion",
        },
         {
            path: 'edit/:id',
            component: EditContactsContainerComponent,
            title: "Edit Contacts Details",
        },  
         {
            path: 'booking/:id',
            component: BookSessionContainerComponent,
            title: "Book a Prospect Session - Prosepct session booking",
        },  
              
    ],
  },
];