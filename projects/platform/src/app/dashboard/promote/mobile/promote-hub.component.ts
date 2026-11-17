import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PromoteHubComponent } from '../promote-hub.component';

/** Dedicated mobile entry point for PromoteHubComponent. */
@Component({
  selector: 'async-promote-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PromoteHubComponent],
  template: `<async-promote-hub />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class PromoteHubMobileComponent {}
