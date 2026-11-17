import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BillingContainerComponent } from '../billing-container.component';

/** Dedicated mobile entry point for BillingContainerComponent. */
@Component({
  selector: 'async-billing-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [BillingContainerComponent],
  template: `<async-billing-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class BillingContainerMobileComponent {}
