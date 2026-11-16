import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TeamSupportContainerComponent } from '../support-container.component';

/**
 * Mobile shell for TeamSupportContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-team-support-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TeamSupportContainerComponent],
  template: `<async-team-support-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class TeamSupportMobileComponent {}
