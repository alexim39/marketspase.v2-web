import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MoreHubComponent } from './more-hub.component';
import { MoreHubMobileComponent } from './mobile/more-hub.component';

@Component({
  selector: 'async-more-hub-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MoreHubComponent, MoreHubMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-more-hub-mobile />
    } @else {
      <async-more-hub />
    }
  `,
})
export class MoreHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
