import { Routes } from '@angular/router';
import { CommunityFeedComponent } from './feed/community-feed.component';
import { CommunityEventsComponent } from './events/events.component';
import { CommunityHubComponent } from './hub/community-hub.component';

export const CommunityRoutes: Routes = [
  {
    path: '',
    component: CommunityHubComponent,
    title: 'Community - Talk, meet and message',
  },
  {
    path: 'feed',
    component: CommunityFeedComponent,
    title: 'Community Feed - Team feed and recognition',
  },
  {
    path: 'events',
    component: CommunityEventsComponent,
    title: 'Community Events - Gatherings and RSVP',
  },
];
