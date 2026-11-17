import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { NotificationPreferencesComponent } from './preferences.component';
import { NotificationPreferencesMobileComponent } from './mobile/preferences.component';

@Component({
  selector: 'async-notification-preferences-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [NotificationPreferencesComponent, NotificationPreferencesMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-notification-preferences-mobile />
    } @else {
      <async-notification-preferences />
    }
  `,
})
export class NotificationPreferencesIndexComponent {
  protected readonly device = inject(DeviceService);
}
