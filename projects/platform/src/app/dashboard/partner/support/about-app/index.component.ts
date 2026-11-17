import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { AboutAppContainerComponent } from './about-app-container.component';
import { AboutAppContainerMobileComponent } from './mobile/about-app-container.component';

@Component({
  selector: 'async-about-app-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AboutAppContainerComponent, AboutAppContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-about-app-mobile />
    } @else {
      <async-about-app-container />
    }
  `,
})
export class AboutAppContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
