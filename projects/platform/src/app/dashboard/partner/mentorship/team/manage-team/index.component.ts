import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ManageTeamContainerComponent } from './manage-team-container.component';
import { ManageTeamMobileComponent } from './mobile/manage-team.component';

@Component({
  selector: 'async-manage-team-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ManageTeamContainerComponent, ManageTeamMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-manage-team-mobile />
    } @else {
      <async-manage-team-container />
    }
  `,
})
export class ManageTeamIndexComponent {
  protected readonly device = inject(DeviceService);
}
