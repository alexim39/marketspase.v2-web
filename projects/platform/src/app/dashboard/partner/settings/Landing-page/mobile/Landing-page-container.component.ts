import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingPageSettingContainerComponent } from '../Landing-page-container.component';

/** Dedicated mobile entry point for LandingPageSettingContainerComponent. */
@Component({
  selector: 'async-landing-page-settings-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LandingPageSettingContainerComponent],
  template: `<async-landing-page-setting-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class LandingPageSettingContainerMobileComponent {}
