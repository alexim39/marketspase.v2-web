import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LaunchPathComponent } from '../launch-path.component';

/** Dedicated mobile entry point for LaunchPathComponent. */
@Component({
  selector: 'async-launch-path-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LaunchPathComponent],
  template: `<async-launch-path />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class LaunchPathMobileComponent {}
