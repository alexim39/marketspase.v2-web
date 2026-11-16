import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { AboutPageDesktopComponent } from './desktop/about-page.component';
import { AboutPageMobileComponent } from './mobile/about-page.component';

@Component({
  selector: 'async-about-page-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutPageDesktopComponent, AboutPageMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-about-page-mobile />
    } @else {
      <async-about-page-desktop />
    }
  `,
})
export class AboutPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
