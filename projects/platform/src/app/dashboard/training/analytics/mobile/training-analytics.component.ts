import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TrainingAnalyticsComponent } from '../training-analytics.component';

/** Dedicated mobile entry point for TrainingAnalyticsComponent. */
@Component({
  selector: 'async-training-analytics-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingAnalyticsComponent],
  template: `<async-training-analytics />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TrainingAnalyticsMobileComponent {}
