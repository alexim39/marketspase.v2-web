import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LandingDesktopComponent } from './desktop/index-body.component';
import { LandingMobileComponent } from './mobile/index-body.component';

@Component({
  selector: 'async-landing-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LandingDesktopComponent, LandingMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-landing-mobile />
    } @else {
      <async-landing-desktop />
    }
  `,
})
export class LandingIndexComponent {
  protected readonly device = inject(DeviceService);
}
