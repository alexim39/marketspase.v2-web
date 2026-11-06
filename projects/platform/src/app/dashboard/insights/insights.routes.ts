import { Routes } from '@angular/router';
import { DownloadsComponent } from './downloads/downloads.component';
import { InsightsOverviewComponent } from './overview/insights.component';
import { MyBusinessComponent } from './my-business/my-business.component';
import { TeamReportsComponent } from './team-reports/team-reports.component';
import { ManageContactsAnalyticsComponent } from '../partner/contacts/manage/analytics/manage-contacts-analytics.component';

export const InsightsRoutes: Routes = [
  {
    path: '',
    component: InsightsOverviewComponent,
    title: 'Insights - Actions, funnel and team health',
  },
  {
    path: 'my-business',
    component: MyBusinessComponent,
    title: 'My Business - Your numbers and next moves',
  },
  {
    path: 'team-reports',
    component: TeamReportsComponent,
    title: 'Team Reports - Report up, request down',
  },
  {
    path: 'contact-analytics',
    component: ManageContactsAnalyticsComponent,
    title: 'Contact Summary & Analytics',
  },
  {
    path: 'downloads',
    component: DownloadsComponent,
    title: 'Reports & Downloads - Export your business data',
  },
];
