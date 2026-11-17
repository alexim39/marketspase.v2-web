import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TutorialsComponent } from '../tutorials.component';

/** Dedicated mobile entry point for TutorialsComponent. */
@Component({
  selector: 'async-training-tutorials-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TutorialsComponent],
  template: `<async-tutorials />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TutorialsMobileComponent {}
