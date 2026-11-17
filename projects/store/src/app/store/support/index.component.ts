import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreSupportComponent } from './store-support.component';
import { StoreSupportMobileComponent } from './mobile/store-support.component';

@Component({
  selector: 'async-store-support-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreSupportComponent, StoreSupportMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-support-mobile />
    } @else {
      <async-store-support />
    }
  `,
})
export class StoreSupportIndexComponent {
  protected readonly device = inject(DeviceService);
}
