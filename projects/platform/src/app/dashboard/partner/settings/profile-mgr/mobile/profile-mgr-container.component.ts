import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfileMrgContainerComponent } from '../profile-mgr-container.component';

/** Dedicated mobile entry point for ProfileMrgContainerComponent. */
@Component({
  selector: 'async-profile-mgr-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ProfileMrgContainerComponent],
  template: `<async-profile-mgr-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class ProfileMrgContainerMobileComponent {}
