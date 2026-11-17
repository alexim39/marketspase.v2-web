import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LearnHubComponent } from '../learn-hub.component';

/** Dedicated mobile entry point for LearnHubComponent. */
@Component({
  selector: 'async-learn-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LearnHubComponent],
  template: `<async-learn-hub />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class LearnHubMobileComponent {}
