import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProgressComponent } from '../progress.component';

/** Dedicated mobile entry point for ProgressComponent. */
@Component({
  selector: 'async-progress-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ProgressComponent],
  template: `<async-progress />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class ProgressMobileComponent {}
