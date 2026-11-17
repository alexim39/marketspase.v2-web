import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StorefrontComponent } from './storefront.component';
import { StorefrontMobileComponent } from './mobile/storefront.component';

@Component({
  selector: 'async-storefront-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StorefrontComponent, StorefrontMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-storefront-mobile />
    } @else {
      <async-storefront />
    }
  `,
})
export class StorefrontIndexComponent {
  protected readonly device = inject(DeviceService);
}
