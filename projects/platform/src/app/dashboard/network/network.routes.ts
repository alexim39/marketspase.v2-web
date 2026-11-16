import { Routes } from '@angular/router';
import { NetworkTreeIndexComponent } from './tree/index.component';
import { OrgChartIndexComponent } from './org/index.component';
import { MemberViewIndexComponent } from './view/index.component';

export const NetworkRoutes: Routes = [
  {
    path: '',
    redirectTo: 'tree',
    pathMatch: 'full',
  },
  {
    path: 'tree',
    component: NetworkTreeIndexComponent,
    title: 'Network Tree - Visualize your downline',
  },
  {
    path: 'org',
    component: OrgChartIndexComponent,
    title: 'Org Chart - Levels and span of control',
  },
  {
    path: 'view/:id',
    component: MemberViewIndexComponent,
    title: 'Member View - Read-only member overview',
  },
];
