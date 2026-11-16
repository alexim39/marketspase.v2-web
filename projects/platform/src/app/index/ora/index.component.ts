import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { OraPublicPageDesktopComponent } from './desktop/ora-page.component';
import { OraPublicPageMobileComponent } from './mobile/ora-page.component';
import { OraPublicFacade } from './state/ora-public.facade';

@Component({
  selector: 'async-ora-page-public-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OraPublicPageDesktopComponent, OraPublicPageMobileComponent],
  providers: [OraPublicFacade],
  template: `
    @if (device.isMobileView()) {
      <async-ora-page-public-mobile />
    } @else {
      <async-ora-page-public-desktop />
    }
  `,
})
export class OraPublicPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
