import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { DownloadsComponent } from './downloads.component';
import { DownloadsMobileComponent } from './mobile/downloads.component';

@Component({
  selector: 'async-downloads-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [DownloadsComponent, DownloadsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-downloads-mobile />
    } @else {
      <async-downloads />
    }
  `,
})
export class DownloadsIndexComponent {
  protected readonly device = inject(DeviceService);
}
