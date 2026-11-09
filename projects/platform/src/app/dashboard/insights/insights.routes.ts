import { Routes } from '@angular/router';
import { DownloadsComponent } from './downloads/downloads.component';
import { InsightsOverviewComponent } from './overview/insights.component';
import { MyBusinessComponent } from './my-business/my-business.component';

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
    path: 'downloads',
    component: DownloadsComponent,
    title: 'Reports & Downloads - Export your business data',
  },
];
