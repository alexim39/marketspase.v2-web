import { Routes } from '@angular/router';
import { NotificationsCenterComponent } from './center/center.component';
import { NotificationPreferencesComponent } from './preferences/preferences.component';

export const NotificationsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'center',
    pathMatch: 'full',
  },
  {
    path: 'center',
    component: NotificationsCenterComponent,
    title: 'Notifications - Actionable updates and announcements',
  },
  {
    path: 'preferences',
    component: NotificationPreferencesComponent,
    title: 'Notifications - Settings',
  },
];
