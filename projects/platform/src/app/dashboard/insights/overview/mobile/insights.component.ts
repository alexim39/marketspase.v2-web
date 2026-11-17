import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InsightsOverviewComponent } from '../insights.component';

/** Dedicated mobile entry point for InsightsOverviewComponent. */
@Component({
  selector: 'async-insights-overview-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [InsightsOverviewComponent],
  template: `<async-insights-overview />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class InsightsOverviewMobileComponent {}
