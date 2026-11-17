import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CookiesComponent } from './cookies.component';
import { CookiesMobileComponent } from './mobile/cookies.component';

@Component({
  selector: 'async-cookies-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CookiesComponent, CookiesMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-cookies-mobile />
    } @else {
      <async-cookies />
    }
  `,
})
export class CookiesIndexComponent {
  protected readonly device = inject(DeviceService);
}
