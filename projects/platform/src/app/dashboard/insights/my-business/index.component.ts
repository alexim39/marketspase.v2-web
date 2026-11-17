import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyBusinessComponent } from './my-business.component';
import { MyBusinessMobileComponent } from './mobile/my-business.component';

@Component({
  selector: 'async-my-business-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyBusinessComponent, MyBusinessMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-my-business-mobile />
    } @else {
      <async-my-business />
    }
  `,
})
export class MyBusinessIndexComponent {
  protected readonly device = inject(DeviceService);
}
