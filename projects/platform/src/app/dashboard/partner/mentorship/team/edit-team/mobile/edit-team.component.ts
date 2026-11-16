import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EditTeamContainerComponent } from '../edit-team-container.component';

/**
 * Mobile shell for EditTeamContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-edit-team-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [EditTeamContainerComponent],
  template: `<async-edit-team-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class EditTeamMobileComponent {}
