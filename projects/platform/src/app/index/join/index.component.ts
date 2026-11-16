import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { JoinLandingDesktopComponent } from './desktop/join-landing.component';
import { JoinLandingMobileComponent } from './mobile/join-landing.component';
import { JoinLandingFacade } from './state/join-landing.facade';

@Component({
  selector: 'async-join-landing-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JoinLandingDesktopComponent, JoinLandingMobileComponent],
  providers: [JoinLandingFacade],
  template: `
    @if (device.isMobileView()) {
      <async-join-landing-mobile />
    } @else {
      <async-join-landing-desktop />
    }
  `,
})
export class JoinLandingIndexComponent {
  protected readonly device = inject(DeviceService);
}
