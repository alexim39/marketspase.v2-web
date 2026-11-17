import { Routes } from '@angular/router';
import { NotificationsCenterIndexComponent } from './center/index.component';
import { NotificationPreferencesIndexComponent } from './preferences/index.component';

export const NotificationsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'center',
    pathMatch: 'full',
  },
  {
    path: 'center',
    component: NotificationsCenterIndexComponent,
    title: 'Notifications - Actionable updates and announcements',
  },
  {
    path: 'preferences',
    component: NotificationPreferencesIndexComponent,
    title: 'Notifications - Settings',
  },
];
