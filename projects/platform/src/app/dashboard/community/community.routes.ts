import { Routes } from '@angular/router';
import { CommunityFeedIndexComponent } from './feed/index.component';
import { CommunityEventsIndexComponent } from './events/index.component';
import { CommunityHubIndexComponent } from './hub/index.component';

export const CommunityRoutes: Routes = [
  {
    path: '',
    component: CommunityHubIndexComponent,
    title: 'Community - Talk, meet and message',
  },
  {
    path: 'feed',
    component: CommunityFeedIndexComponent,
    title: 'Community Feed - Team feed and recognition',
  },
  {
    path: 'events',
    component: CommunityEventsIndexComponent,
    title: 'Community Events - Gatherings and RSVP',
  },
];
