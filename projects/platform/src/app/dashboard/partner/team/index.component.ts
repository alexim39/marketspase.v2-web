import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TeamHubDesktopComponent } from './desktop/team-hub.component';
import { TeamHubMobileComponent } from './mobile/team-hub.component';
import { TeamHubFacade } from './state/team-hub.facade';

@Component({
  selector: 'async-team-hub-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TeamHubDesktopComponent, TeamHubMobileComponent],
  providers: [TeamHubFacade],
  template: `
    @if (device.isMobileView()) {
      <async-team-hub-mobile />
    } @else {
      <async-team-hub-desktop />
    }
  `,
})
export class TeamHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
