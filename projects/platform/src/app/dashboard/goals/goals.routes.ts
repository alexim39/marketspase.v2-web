import { Routes } from '@angular/router';
import { GoalsIndexComponent } from './list/index.component';

export const GoalsRoutes: Routes = [
  {
    path: '',
    component: GoalsIndexComponent,
    title: 'My Goals - Targets, progress and sales trends',
  },
];
