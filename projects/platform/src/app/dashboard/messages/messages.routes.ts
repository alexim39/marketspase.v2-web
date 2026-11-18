import { Routes } from '@angular/router';
import { MessagesIndexComponent } from './inbox/index.component';
import { SmsCenterIndexComponent } from './sms/index.component';

export const MessagesRoutes: Routes = [
  {
    path: 'sms',
    component: SmsCenterIndexComponent,
    title: 'SMS Center - Direct messages to prospects, customers and partners',
  },
  {
    path: '',
    component: MessagesIndexComponent,
    title: 'Messages - Inbox and team announcements',
  },
];
