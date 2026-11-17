import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PipelineHubComponent } from './pipeline-hub.component';
import { PipelineHubMobileComponent } from './mobile/pipeline-hub.component';

@Component({
  selector: 'async-pipeline-hub-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PipelineHubComponent, PipelineHubMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-pipeline-hub-mobile />
    } @else {
      <async-pipeline-hub />
    }
  `,
})
export class PipelineHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
