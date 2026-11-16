import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CreateTeamContainerComponent } from './create-team-container.component';
import { CreateTeamMobileComponent } from './mobile/create-team.component';

@Component({
  selector: 'async-create-team-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CreateTeamContainerComponent, CreateTeamMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-create-team-mobile />
    } @else {
      <async-create-team-container />
    }
  `,
})
export class CreateTeamIndexComponent {
  protected readonly device = inject(DeviceService);
}
