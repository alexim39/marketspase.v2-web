import { Routes } from '@angular/router';
import { CustomerLeadsComponent } from './customer-leads/customer-leads.component';
import { LeadPipelineComponent } from './lead-pipeline/lead-pipeline.component';
import { PipelineBoardComponent } from './pipeline-board/board.component';
import { RemindersComponent } from './reminders/reminders.component';
import { ProspectDetailComponent } from './prospect-detail/detail.component';
import { EditContactsContainerComponent } from '../contacts/edit/edit-contacts-container.component';
import { ProspectCreateComponent } from './prospect-create.component';

export const ProspectsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'pipeline',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
        { path: 'bookings', redirectTo: 'pipeline', pathMatch: 'full' },
        { path: 'kits', redirectTo: 'pipeline', pathMatch: 'full' },
        { path: 'booking/:id', redirectTo: 'pipeline', pathMatch: 'full' },
        {
            path: 'customer-leads',
            component: CustomerLeadsComponent,
            title: "Customer Leads - People who checked out from your store",
        },
        {
            path: 'personal-list',
            redirectTo: 'customer-leads',
            pathMatch: 'full',
        },
        {
            path: 'pipeline',
            component: LeadPipelineComponent,
            title: "Lead Pipeline - Track prospects through to conversion",
        },
        {
            path: 'new',
            component: ProspectCreateComponent,
            title: "Add prospect - New pipeline conversation",
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
    ],
  },
];
