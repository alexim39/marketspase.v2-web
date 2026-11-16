import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { FaqPageDesktopComponent } from './desktop/faq-page.component';
import { FaqPageMobileComponent } from './mobile/faq-page.component';

@Component({
  selector: 'async-faq-page-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaqPageDesktopComponent, FaqPageMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-faq-page-mobile />
    } @else {
      <async-faq-page-desktop />
    }
  `,
})
export class FaqPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
