import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { RemindersDesktopComponent } from './desktop/reminders.component';
import { RemindersMobileComponent } from './mobile/reminders.component';
import { RemindersFacade } from './state/reminders.facade';

@Component({
  selector: 'async-reminders-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RemindersDesktopComponent, RemindersMobileComponent],
  providers: [RemindersFacade],
  template: `
    @if (device.isMobileView()) {
      <async-reminders-mobile />
    } @else {
      <async-reminders-desktop />
    }
  `,
})
export class RemindersIndexComponent {
  protected readonly device = inject(DeviceService);
}
