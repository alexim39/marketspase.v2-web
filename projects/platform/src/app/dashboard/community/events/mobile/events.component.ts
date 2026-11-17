import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommunityEventsComponent } from '../events.component';

/** Dedicated mobile entry point for CommunityEventsComponent. */
@Component({
  selector: 'async-community-events-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityEventsComponent],
  template: `<async-community-events />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class CommunityEventsMobileComponent {}
