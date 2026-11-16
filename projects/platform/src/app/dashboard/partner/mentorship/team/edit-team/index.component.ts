import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { EditTeamContainerComponent } from './edit-team-container.component';
import { EditTeamMobileComponent } from './mobile/edit-team.component';

@Component({
  selector: 'async-edit-team-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [EditTeamContainerComponent, EditTeamMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-edit-team-mobile />
    } @else {
      <async-edit-team-container />
    }
  `,
})
export class EditTeamIndexComponent {
  protected readonly device = inject(DeviceService);
}
