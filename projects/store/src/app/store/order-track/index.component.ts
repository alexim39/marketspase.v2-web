import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreOrderTrackComponent } from './order-track.component';
import { StoreOrderTrackMobileComponent } from './mobile/order-track.component';

@Component({
  selector: 'async-store-order-track-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreOrderTrackComponent, StoreOrderTrackMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-order-track-mobile />
    } @else {
      <async-store-order-track />
    }
  `,
})
export class StoreOrderTrackIndexComponent {
  protected readonly device = inject(DeviceService);
}
