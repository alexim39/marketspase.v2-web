import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreCheckoutComponent } from './checkout.component';
import { StoreCheckoutMobileComponent } from './mobile/checkout.component';

@Component({
  selector: 'async-store-checkout-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCheckoutComponent, StoreCheckoutMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-checkout-mobile />
    } @else {
      <async-store-checkout />
    }
  `,
})
export class StoreCheckoutIndexComponent {
  protected readonly device = inject(DeviceService);
}
