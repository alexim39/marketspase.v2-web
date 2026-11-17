import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AboutAppContainerComponent } from '../about-app-container.component';

/** Dedicated mobile entry point for AboutAppContainerComponent. */
@Component({
  selector: 'async-about-app-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AboutAppContainerComponent],
  template: `<async-about-app-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class AboutAppContainerMobileComponent {}
