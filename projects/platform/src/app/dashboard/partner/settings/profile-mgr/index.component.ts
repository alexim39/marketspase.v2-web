import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProfileMrgContainerComponent } from './profile-mgr-container.component';
import { ProfileMrgContainerMobileComponent } from './mobile/profile-mgr-container.component';

@Component({
  selector: 'async-profile-mgr-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ProfileMrgContainerComponent, ProfileMrgContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-profile-mgr-mobile />
    } @else {
      <async-profile-mgr-container />
    }
  `,
})
export class ProfileMrgContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
