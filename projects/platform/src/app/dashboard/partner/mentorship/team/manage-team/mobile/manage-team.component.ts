import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ManageTeamContainerComponent } from '../manage-team-container.component';

/**
 * Mobile shell for ManageTeamContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-manage-team-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ManageTeamContainerComponent],
  template: `<async-manage-team-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class ManageTeamMobileComponent {}
