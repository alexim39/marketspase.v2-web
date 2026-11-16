import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductService } from '../monthly-purchase.service';
import { ResaleHubDesktopComponent } from './desktop/resale-hub.component';
import { ResaleHubMobileComponent } from './mobile/resale-hub.component';
import { ResaleHubFacade } from './state/resale-hub.facade';

@Component({
  selector: 'async-resale-hub-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ResaleHubDesktopComponent, ResaleHubMobileComponent],
  providers: [ProductService, ResaleHubFacade],
  template: `
    @if (device.isMobileView()) {
      <async-resale-hub-mobile />
    } @else {
      <async-resale-hub-desktop />
    }
  `,
})
export class ResaleHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
