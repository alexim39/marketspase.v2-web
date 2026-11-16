import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PartnerVerifyEmailDesktopComponent } from './desktop/partner-verify-email.component';
import { PartnerVerifyEmailMobileComponent } from './mobile/partner-verify-email.component';
import { VerifyEmailFacade } from './state/verify-email.facade';

@Component({
  selector: 'async-partner-verify-email-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerVerifyEmailDesktopComponent, PartnerVerifyEmailMobileComponent],
  providers: [VerifyEmailFacade],
  template: `
    @if (device.isMobileView()) {
      <async-partner-verify-email-mobile />
    } @else {
      <async-partner-verify-email-desktop />
    }
  `,
})
export class PartnerVerifyEmailIndexComponent {
  protected readonly device = inject(DeviceService);
}
