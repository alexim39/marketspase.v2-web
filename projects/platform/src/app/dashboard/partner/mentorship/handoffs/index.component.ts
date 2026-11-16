import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MentorHandoffsDesktopComponent } from './desktop/mentor-handoffs.component';
import { MentorHandoffsMobileComponent } from './mobile/mentor-handoffs.component';
import { MentorHandoffsFacade } from './state/mentor-handoffs.facade';

@Component({
  selector: 'async-mentor-handoffs-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MentorHandoffsDesktopComponent, MentorHandoffsMobileComponent],
  providers: [MentorHandoffsFacade],
  template: `
    @if (device.isMobileView()) {
      <async-mentor-handoffs-mobile />
    } @else {
      <async-mentor-handoffs-desktop />
    }
  `,
})
export class MentorHandoffsIndexComponent {
  protected readonly device = inject(DeviceService);
}
