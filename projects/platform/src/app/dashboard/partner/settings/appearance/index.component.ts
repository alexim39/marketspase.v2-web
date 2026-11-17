import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { AppearanceSettingsComponent } from './appearance.component';
import { AppearanceSettingsMobileComponent } from './mobile/appearance.component';

@Component({
  selector: 'async-appearance-settings-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AppearanceSettingsComponent, AppearanceSettingsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-appearance-settings-mobile />
    } @else {
      <async-appearance-settings />
    }
  `,
})
export class AppearanceSettingsIndexComponent {
  protected readonly device = inject(DeviceService);
}
