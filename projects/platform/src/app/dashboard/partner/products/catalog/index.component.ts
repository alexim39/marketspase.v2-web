import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductCatalogDesktopComponent } from './desktop/product-catalog.component';
import { ProductCatalogMobileComponent } from './mobile/product-catalog.component';
import { ProductService } from '../monthly-purchase.service';
import { ProductCatalogFacade } from './state/product-catalog.facade';

@Component({
  selector: 'async-product-catalog-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCatalogDesktopComponent, ProductCatalogMobileComponent],
  providers: [ProductService, ProductCatalogFacade],
  template: `
    @if (device.isMobileView()) {
      <async-product-catalog-mobile />
    } @else {
      <async-product-catalog-desktop />
    }
  `,
})
export class ProductCatalogIndexComponent {
  protected readonly device = inject(DeviceService);
}
