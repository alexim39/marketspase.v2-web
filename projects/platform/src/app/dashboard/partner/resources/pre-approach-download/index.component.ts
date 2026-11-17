import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PreapproachDownloadContainerComponent } from './pre-approach-download-container.component';
import { PreapproachDownloadContainerMobileComponent } from './mobile/pre-approach-download-container.component';

@Component({
  selector: 'async-prospecting-guides-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PreapproachDownloadContainerComponent, PreapproachDownloadContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-prospecting-guides-mobile />
    } @else {
      <async-manage-campaign-container />
    }
  `,
})
export class PreapproachDownloadContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
