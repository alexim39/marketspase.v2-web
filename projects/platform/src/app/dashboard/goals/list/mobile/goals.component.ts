import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GoalsComponent } from '../goals.component';

/** Dedicated mobile entry point for GoalsComponent. */
@Component({
  selector: 'async-goals-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [GoalsComponent],
  template: `<async-goals />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class GoalsMobileComponent {}
