import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PromoteHubComponent } from './promote-hub.component';
import { PromoteHubMobileComponent } from './mobile/promote-hub.component';

@Component({
  selector: 'async-promote-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PromoteHubComponent, PromoteHubMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-promote-mobile />
    } @else {
      <async-promote-hub />
    }
  `,
})
export class PromoteHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
