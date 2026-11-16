import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LeadPipelineDesktopComponent } from './desktop/lead-pipeline.component';
import { LeadPipelineMobileComponent } from './mobile/lead-pipeline.component';
import { LeadPipelineFacade } from './state/lead-pipeline.facade';

@Component({
  selector: 'async-lead-pipeline-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeadPipelineDesktopComponent, LeadPipelineMobileComponent],
  providers: [LeadPipelineFacade],
  template: `
    @if (device.isMobileView()) {
      <async-lead-pipeline-mobile />
    } @else {
      <async-lead-pipeline-desktop />
    }
  `,
})
export class LeadPipelineIndexComponent {
  protected readonly device = inject(DeviceService);
}
