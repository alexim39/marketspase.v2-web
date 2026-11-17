import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MoreHubComponent } from '../more-hub.component';

/** Dedicated mobile entry point for MoreHubComponent. */
@Component({
  selector: 'async-more-hub-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MoreHubComponent],
  template: `<async-more-hub />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class MoreHubMobileComponent {}
