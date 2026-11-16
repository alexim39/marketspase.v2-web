import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TeamSupportContainerComponent } from './support-container.component';
import { TeamSupportMobileComponent } from './mobile/support.component';

@Component({
  selector: 'async-team-support-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TeamSupportContainerComponent, TeamSupportMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-team-support-mobile />
    } @else {
      <async-team-support-container />
    }
  `,
})
export class TeamSupportIndexComponent {
  protected readonly device = inject(DeviceService);
}
