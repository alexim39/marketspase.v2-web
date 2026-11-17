import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { VerificationComponent } from './verification.component';
import { VerificationMobileComponent } from './mobile/verification.component';

@Component({
  selector: 'async-verification-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [VerificationComponent, VerificationMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-verification-mobile />
    } @else {
      <async-verification />
    }
  `,
})
export class VerificationIndexComponent {
  protected readonly device = inject(DeviceService);
}
