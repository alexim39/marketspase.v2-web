import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductGuidesDesktopComponent } from './desktop/product-guides.component';
import { ProductGuidesMobileComponent } from './mobile/product-guides.component';

@Component({
  selector: 'async-product-guides-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductGuidesDesktopComponent, ProductGuidesMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-product-guides-mobile />
    } @else {
      <async-product-guides-desktop />
    }
  `,
})
export class ProductGuidesIndexComponent {
  protected readonly device = inject(DeviceService);
}
