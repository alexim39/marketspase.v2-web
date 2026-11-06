import { Routes } from '@angular/router';
import { NetworkTreeComponent } from './tree/tree.component';
import { OrgChartComponent } from './org/org.component';
import { MemberViewComponent } from './view/member-view.component';

export const NetworkRoutes: Routes = [
  {
    path: '',
    redirectTo: 'tree',
    pathMatch: 'full',
  },
  {
    path: 'tree',
    component: NetworkTreeComponent,
    title: 'Network Tree - Visualize your downline',
  },
  {
    path: 'org',
    component: OrgChartComponent,
    title: 'Org Chart - Levels and span of control',
  },
  {
    path: 'view/:id',
    component: MemberViewComponent,
    title: 'Member View - Read-only member overview',
  },
];
