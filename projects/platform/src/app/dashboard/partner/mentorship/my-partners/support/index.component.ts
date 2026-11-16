import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyPartnerSupportContainerComponent } from './support-container.component';
import { MyPartnerSupportMobileComponent } from './mobile/support.component';

@Component({
  selector: 'async-my-partner-support-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnerSupportContainerComponent, MyPartnerSupportMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-my-partner-support-mobile />
    } @else {
      <async-my-partner-support-container />
    }
  `,
})
export class MyPartnerSupportIndexComponent {
  protected readonly device = inject(DeviceService);
}
