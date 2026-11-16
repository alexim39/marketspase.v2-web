import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyPartnersContactsContainerComponent } from '../contacts-container.component';

/**
 * Mobile shell for MyPartnersContactsContainerComponent. The underlying operational view is
 * responsive; this wrapper gives the route a dedicated mobile entry point.
 */
@Component({
  selector: 'async-my-partners-contacts-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnersContactsContainerComponent],
  template: `<async-manage-contacts-container />`,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class MyPartnersContactsMobileComponent {}
