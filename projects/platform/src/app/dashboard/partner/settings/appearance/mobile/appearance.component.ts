import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppearanceSettingsComponent } from '../appearance.component';

/** Dedicated mobile entry point for AppearanceSettingsComponent. */
@Component({
  selector: 'async-appearance-settings-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AppearanceSettingsComponent],
  template: `<async-appearance-settings />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class AppearanceSettingsMobileComponent {}
