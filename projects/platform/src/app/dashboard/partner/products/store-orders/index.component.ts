import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreOrdersDesktopComponent } from './desktop/store-orders.component';
import { StoreOrdersMobileComponent } from './mobile/store-orders.component';
import { StoreOrdersFacade } from './state/store-orders.facade';

@Component({
  selector: 'async-store-orders-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoreOrdersDesktopComponent, StoreOrdersMobileComponent],
  providers: [StoreOrdersFacade],
  template: `
    @if (device.isMobileView()) {
      <async-store-orders-mobile />
    } @else {
      <async-store-orders-desktop />
    }
  `,
})
export class StoreOrdersIndexComponent {
  protected readonly device = inject(DeviceService);
}
