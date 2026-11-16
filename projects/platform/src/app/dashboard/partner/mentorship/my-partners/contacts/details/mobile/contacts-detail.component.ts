import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyPartnerContactsDetailContainerComponent } from '../contacts-detail-container.component';

/**
 * Mobile shell for MyPartnerContactsDetailContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-my-partner-contact-detail-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnerContactsDetailContainerComponent],
  template: `<async-manage-contacts-detail-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class MyPartnerContactDetailMobileComponent {}
