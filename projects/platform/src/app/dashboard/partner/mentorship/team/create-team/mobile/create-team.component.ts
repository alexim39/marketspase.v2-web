import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CreateTeamContainerComponent } from '../create-team-container.component';

/**
 * Mobile shell for CreateTeamContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-create-team-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CreateTeamContainerComponent],
  template: `<async-create-team-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class CreateTeamMobileComponent {}
