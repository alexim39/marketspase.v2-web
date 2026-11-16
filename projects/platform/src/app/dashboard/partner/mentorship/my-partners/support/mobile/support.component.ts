import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyPartnerSupportContainerComponent } from '../support-container.component';

/**
 * Mobile shell for MyPartnerSupportContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-my-partner-support-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnerSupportContainerComponent],
  template: `<async-my-partner-support-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class MyPartnerSupportMobileComponent {}
