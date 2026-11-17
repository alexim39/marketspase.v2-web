import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TrustCentreComponent } from './trust-centre.component';
import { TrustCentreMobileComponent } from './mobile/trust-centre.component';

@Component({
  selector: 'async-trust-centre-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrustCentreComponent, TrustCentreMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-trust-centre-mobile />
    } @else {
      <async-trust-centre />
    }
  `,
})
export class TrustCentreIndexComponent {
  protected readonly device = inject(DeviceService);
}
