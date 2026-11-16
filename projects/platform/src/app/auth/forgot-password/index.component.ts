import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PartnerForgotPasswordDesktopComponent } from './desktop/partner-forgot-password.component';
import { PartnerForgotPasswordMobileComponent } from './mobile/partner-forgot-password.component';
import { ForgotPasswordFacade } from './state/forgot-password.facade';

@Component({
  selector: 'async-partner-forgot-password-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerForgotPasswordDesktopComponent, PartnerForgotPasswordMobileComponent],
  providers: [ForgotPasswordFacade],
  template: `
    @if (device.isMobileView()) {
      <async-partner-forgot-password-mobile />
    } @else {
      <async-partner-forgot-password-desktop />
    }
  `,
})
export class PartnerForgotPasswordIndexComponent {
  protected readonly device = inject(DeviceService);
}
