import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PartnerSignupDesktopComponent } from './desktop/partner-signup.component';
import { PartnerSignupMobileComponent } from './mobile/partner-signup.component';
import { SignUpFacade } from './state/signup.facade';

@Component({
  selector: 'async-partner-signup-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerSignupDesktopComponent, PartnerSignupMobileComponent],
  providers: [SignUpFacade],
  template: `
    @if (device.isMobileView()) {
      <async-partner-signup-mobile />
    } @else {
      <async-partner-signup-desktop />
    }
  `,
})
export class PartnerSignupIndexComponent {
  protected readonly device = inject(DeviceService);
}
