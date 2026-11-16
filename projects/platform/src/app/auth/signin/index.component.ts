import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PartnerSigninDesktopComponent } from './desktop/partner-signin.component';
import { PartnerSigninMobileComponent } from './mobile/partner-signin.component';
import { SignInFacade } from './state/signin.facade';

@Component({
  selector: 'async-partner-signin-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerSigninDesktopComponent, PartnerSigninMobileComponent],
  providers: [SignInFacade],
  template: `
    @if (device.isMobileView()) {
      <async-partner-signin-mobile />
    } @else {
      <async-partner-signin-desktop />
    }
  `,
})
export class PartnerSigninIndexComponent {
  protected readonly device = inject(DeviceService);
}
