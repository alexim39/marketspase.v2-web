import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PipelineHubComponent } from '../pipeline-hub.component';

/** Dedicated mobile entry point for PipelineHubComponent. */
@Component({
  selector: 'async-pipeline-hub-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PipelineHubComponent],
  template: `<async-pipeline-hub />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class PipelineHubMobileComponent {}
