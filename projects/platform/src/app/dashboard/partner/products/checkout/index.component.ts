import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductService } from '../monthly-purchase.service';
import { CheckoutDesktopComponent } from './desktop/checkout.component';
import { CheckoutMobileComponent } from './mobile/checkout.component';
import { CheckoutFacade } from './state/checkout.facade';

@Component({
  selector: 'async-checkout-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckoutDesktopComponent, CheckoutMobileComponent],
  providers: [ProductService, CheckoutFacade],
  template: `
    @if (device.isMobileView()) {
      <async-checkout-mobile />
    } @else {
      <async-checkout-desktop />
    }
  `,
})
export class CheckoutIndexComponent {
  protected readonly device = inject(DeviceService);
}
