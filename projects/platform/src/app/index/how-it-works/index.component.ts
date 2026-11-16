import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { HowItWorksDesktopComponent } from './desktop/how-it-works.component';
import { HowItWorksMobileComponent } from './mobile/how-it-works.component';

@Component({
  selector: 'async-how-it-works-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HowItWorksDesktopComponent, HowItWorksMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-how-it-works-mobile />
    } @else {
      <async-how-it-works-desktop />
    }
  `,
})
export class HowItWorksIndexComponent {
  protected readonly device = inject(DeviceService);
}
