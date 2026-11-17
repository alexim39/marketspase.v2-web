import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreCartComponent } from './cart.component';
import { StoreCartMobileComponent } from './mobile/cart.component';

@Component({
  selector: 'async-store-cart-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCartComponent, StoreCartMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-cart-mobile />
    } @else {
      <async-store-cart />
    }
  `,
})
export class StoreCartIndexComponent {
  protected readonly device = inject(DeviceService);
}
