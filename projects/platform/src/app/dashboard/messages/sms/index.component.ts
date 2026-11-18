import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { SmsCenterComponent } from './sms-center.component';
import { SmsCenterMobileComponent } from './mobile/sms.component';

@Component({
  selector: 'async-sms-center-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SmsCenterComponent, SmsCenterMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-sms-center-mobile />
    } @else {
      <async-sms-center />
    }
  `,
})
export class SmsCenterIndexComponent {
  protected readonly device = inject(DeviceService);
}
