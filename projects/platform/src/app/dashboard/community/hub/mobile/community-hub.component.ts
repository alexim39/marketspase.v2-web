import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommunityHubComponent } from '../community-hub.component';

/** Dedicated mobile entry point for CommunityHubComponent. */
@Component({
  selector: 'async-community-hub-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityHubComponent],
  template: `<async-community-hub />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class CommunityHubMobileComponent {}
