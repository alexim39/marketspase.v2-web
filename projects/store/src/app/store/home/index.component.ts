import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreHomeComponent } from './store-home.component';
import { StoreHomeMobileComponent } from './mobile/store-home.component';

@Component({
  selector: 'async-store-home-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreHomeComponent, StoreHomeMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-home-mobile />
    } @else {
      <async-store-home />
    }
  `,
})
export class StoreHomeIndexComponent {
  protected readonly device = inject(DeviceService);
}
