import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PartnerResetPasswordDesktopComponent } from './desktop/partner-reset-password.component';
import { PartnerResetPasswordMobileComponent } from './mobile/partner-reset-password.component';
import { ResetPasswordFacade } from './state/reset-password.facade';

@Component({
  selector: 'async-partner-reset-password-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerResetPasswordDesktopComponent, PartnerResetPasswordMobileComponent],
  providers: [ResetPasswordFacade],
  template: `
    @if (device.isMobileView()) {
      <async-partner-reset-password-mobile />
    } @else {
      <async-partner-reset-password-desktop />
    }
  `,
})
export class PartnerResetPasswordIndexComponent {
  protected readonly device = inject(DeviceService);
}
