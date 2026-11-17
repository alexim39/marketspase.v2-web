import { Routes } from '@angular/router';
import { DownloadsIndexComponent } from './downloads/index.component';
import { InsightsOverviewIndexComponent } from './overview/index.component';
import { MyBusinessIndexComponent } from './my-business/index.component';

export const InsightsRoutes: Routes = [
  {
    path: '',
    component: InsightsOverviewIndexComponent,
    title: 'Insights - Actions, funnel and team health',
  },
  {
    path: 'my-business',
    component: MyBusinessIndexComponent,
    title: 'My Business - Your numbers and next moves',
  },
  {
    path: 'downloads',
    component: DownloadsIndexComponent,
    title: 'Reports & Downloads - Export your business data',
  },
];
