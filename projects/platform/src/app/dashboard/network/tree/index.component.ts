import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { NetworkTreeDesktopComponent } from './desktop/tree.component';
import { NetworkTreeMobileComponent } from './mobile/tree.component';

@Component({
  selector: 'async-network-tree-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NetworkTreeDesktopComponent, NetworkTreeMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-network-tree-mobile />
    } @else {
      <async-network-tree-desktop />
    }
  `,
})
export class NetworkTreeIndexComponent {
  protected readonly device = inject(DeviceService);
}
