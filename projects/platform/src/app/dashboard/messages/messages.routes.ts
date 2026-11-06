import { Routes } from '@angular/router';
import { MessagesComponent } from './inbox/messages.component';

export const MessagesRoutes: Routes = [
  {
    path: '',
    component: MessagesComponent,
    title: 'Messages - Inbox and team announcements',
  },
];
