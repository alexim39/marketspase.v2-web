import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreCheckoutResultComponent } from '../checkout-result.component';

/** Dedicated mobile entry point for StoreCheckoutResultComponent. */
@Component({
  selector: 'async-store-checkout-result-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCheckoutResultComponent],
  template: `<async-store-checkout-result />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreCheckoutResultMobileComponent {}
