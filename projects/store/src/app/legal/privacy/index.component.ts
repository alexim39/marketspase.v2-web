import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PrivacyComponent } from './privacy.component';
import { PrivacyMobileComponent } from './mobile/privacy.component';

@Component({
  selector: 'async-privacy-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PrivacyComponent, PrivacyMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-privacy-mobile />
    } @else {
      <async-privacy />
    }
  `,
})
export class PrivacyIndexComponent {
  protected readonly device = inject(DeviceService);
}
