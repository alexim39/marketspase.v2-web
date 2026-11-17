import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ResourceDownloadContainerComponent } from './resource-download-container.component';
import { ResourceDownloadContainerMobileComponent } from './mobile/resource-download-container.component';

@Component({
  selector: 'async-resource-library-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ResourceDownloadContainerComponent, ResourceDownloadContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-resource-library-mobile />
    } @else {
      <async-resource-download-container />
    }
  `,
})
export class ResourceDownloadContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
