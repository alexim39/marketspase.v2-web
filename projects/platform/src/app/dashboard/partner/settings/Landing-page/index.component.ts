import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LandingPageSettingContainerComponent } from './Landing-page-container.component';
import { LandingPageSettingContainerMobileComponent } from './mobile/Landing-page-container.component';

@Component({
  selector: 'async-landing-page-settings-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LandingPageSettingContainerComponent, LandingPageSettingContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-landing-page-settings-mobile />
    } @else {
      <async-landing-page-setting-container />
    }
  `,
})
export class LandingPageSettingContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
