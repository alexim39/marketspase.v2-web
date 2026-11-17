import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TrainingDetailComponent } from '../training-detail.component';

/** Dedicated mobile entry point for TrainingDetailComponent. */
@Component({
  selector: 'async-training-detail-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingDetailComponent],
  template: `<async-training-detail />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TrainingDetailMobileComponent {}
