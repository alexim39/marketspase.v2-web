import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { StoreDirectoryComponent } from './store-directory.component';
import { StoreDirectoryMobileComponent } from './mobile/store-directory.component';

@Component({
  selector: 'async-store-directory-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreDirectoryComponent, StoreDirectoryMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-store-directory-mobile />
    } @else {
      <async-store-directory />
    }
  `,
})
export class StoreDirectoryIndexComponent {
  protected readonly device = inject(DeviceService);
}
