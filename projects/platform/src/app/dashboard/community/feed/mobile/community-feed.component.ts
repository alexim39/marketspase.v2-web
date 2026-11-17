import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommunityFeedComponent } from '../community-feed.component';

/** Dedicated mobile entry point for CommunityFeedComponent. */
@Component({
  selector: 'async-community-feed-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityFeedComponent],
  template: `<async-community-feed />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class CommunityFeedMobileComponent {}
