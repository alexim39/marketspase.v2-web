import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductPageDesktopComponent } from './desktop/product-page.component';
import { ProductPageMobileComponent } from './mobile/product-page.component';
import { ProductService } from '../monthly-purchase.service';
import { ProductPageFacade } from './state/product-page.facade';

@Component({
  selector: 'async-product-page-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductPageDesktopComponent, ProductPageMobileComponent],
  providers: [ProductService, ProductPageFacade],
  template: `
    @if (device.isMobileView()) {
      <async-product-page-mobile />
    } @else {
      <async-product-page-desktop />
    }
  `,
})
export class ProductPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
