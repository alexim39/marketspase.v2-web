import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreCheckoutResultComponent } from './checkout-result.component';
import { StoreCheckoutResultMobileComponent } from './mobile/checkout-result.component';

@Component({
  selector: 'async-store-checkout-result-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCheckoutResultComponent, StoreCheckoutResultMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-checkout-result-mobile />
    } @else {
      <async-store-checkout-result />
    }
  `,
})
export class StoreCheckoutResultIndexComponent {
  protected readonly device = inject(DeviceService);
}
