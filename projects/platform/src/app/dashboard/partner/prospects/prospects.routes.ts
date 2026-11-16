import { Routes } from '@angular/router';
import { CustomerLeadsIndexComponent } from './customer-leads/index.component';
import { LeadPipelineIndexComponent } from './lead-pipeline/index.component';
import { PipelineBoardIndexComponent } from './pipeline-board/index.component';
import { RemindersIndexComponent } from './reminders/index.component';
import { ProspectDetailIndexComponent } from './prospect-detail/index.component';
import { EditContactsIndexComponent } from '../contacts/edit/index.component';
import { ProspectCreateIndexComponent } from './new/index.component';

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
            component: CustomerLeadsIndexComponent,
            title: "Customer Leads - People who checked out from your store",
        },
        {
            path: 'personal-list',
            redirectTo: 'customer-leads',
            pathMatch: 'full',
        },
        {
            path: 'pipeline',
            component: LeadPipelineIndexComponent,
            title: "Lead Pipeline - Track prospects through to conversion",
        },
        {
            path: 'new',
            component: ProspectCreateIndexComponent,
            title: "Add prospect - New pipeline conversation",
        },
        {
            path: 'reminders',
            component: RemindersIndexComponent,
            title: "Reminders - Follow-up commitments due",
        },
        {
            path: 'board',
            component: PipelineBoardIndexComponent,
            title: "Pipeline Board - Drag and drop your deals",
        },
        {
            path: 'detail/:id',
            component: ProspectDetailIndexComponent,
            title: "Prospect Details - Timeline, activities and conversion",
        },
        {
            path: 'edit/:id',
            component: EditContactsIndexComponent,
            title: "Edit Contacts Details",
        },
    ],
  },
];
