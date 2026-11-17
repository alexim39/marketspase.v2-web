import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { NotificationsCenterComponent } from './center.component';
import { NotificationsCenterMobileComponent } from './mobile/center.component';

@Component({
  selector: 'async-notifications-center-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [NotificationsCenterComponent, NotificationsCenterMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-notifications-center-mobile />
    } @else {
      <async-notifications-center />
    }
  `,
})
export class NotificationsCenterIndexComponent {
  protected readonly device = inject(DeviceService);
}
