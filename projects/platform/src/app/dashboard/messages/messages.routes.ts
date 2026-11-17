import { Routes } from '@angular/router';
import { MessagesIndexComponent } from './inbox/index.component';

export const MessagesRoutes: Routes = [
  {
    path: '',
    component: MessagesIndexComponent,
    title: 'Messages - Inbox and team announcements',
  },
];
