import { Routes } from '@angular/router';
import { GoalsComponent } from './list/goals.component';

export const GoalsRoutes: Routes = [
  {
    path: '',
    component: GoalsComponent,
    title: 'My Goals - Targets, progress and sales trends',
  },
];
