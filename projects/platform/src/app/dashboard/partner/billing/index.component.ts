import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { BillingContainerComponent } from './billing-container.component';
import { BillingContainerMobileComponent } from './mobile/billing-container.component';

@Component({
  selector: 'async-billing-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [BillingContainerComponent, BillingContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-billing-mobile />
    } @else {
      <async-billing-container />
    }
  `,
})
export class BillingContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
