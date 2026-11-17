import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreProductComponent } from './store-product.component';
import { StoreProductMobileComponent } from './mobile/store-product.component';

@Component({
  selector: 'async-store-product-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreProductComponent, StoreProductMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-product-mobile />
    } @else {
      <async-store-product />
    }
  `,
})
export class StoreProductIndexComponent {
  protected readonly device = inject(DeviceService);
}
