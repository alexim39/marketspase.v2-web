import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AcademyDashboardComponent } from '../academy-dashboard.component';

/** Dedicated mobile entry point for AcademyDashboardComponent. */
@Component({
  selector: 'async-training-dashboard-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AcademyDashboardComponent],
  template: `<async-training-dashboard />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class AcademyDashboardMobileComponent {}
