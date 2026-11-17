import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { OraPageComponent } from './ora-page.component';
import { OraPageMobileComponent } from './mobile/ora-page.component';

@Component({
  selector: 'async-ora-page-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [OraPageComponent, OraPageMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-ora-page-mobile />
    } @else {
      <async-ora-page />
    }
  `,
})
export class OraPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
