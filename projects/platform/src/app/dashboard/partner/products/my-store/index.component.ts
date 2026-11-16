import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyStoreDesktopComponent } from './desktop/my-store.component';
import { MyStoreMobileComponent } from './mobile/my-store.component';
import { MyStoreFacade } from './state/my-store.facade';

@Component({
  selector: 'async-my-store-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MyStoreDesktopComponent, MyStoreMobileComponent],
  providers: [MyStoreFacade],
  template: `
    @if (device.isMobileView()) {
      <async-my-store-mobile />
    } @else {
      <async-my-store-desktop />
    }
  `,
})
export class MyStoreIndexComponent {
  protected readonly device = inject(DeviceService);
}
