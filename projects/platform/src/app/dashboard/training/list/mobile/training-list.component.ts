import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TrainingListComponent } from '../training-list.component';

/** Dedicated mobile entry point for TrainingListComponent. */
@Component({
  selector: 'async-training-list-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingListComponent],
  template: `<async-training-list />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TrainingListMobileComponent {}
