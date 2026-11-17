import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreCheckoutComponent } from '../checkout.component';

/** Dedicated mobile entry point for StoreCheckoutComponent. */
@Component({
  selector: 'async-store-checkout-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCheckoutComponent],
  template: `<async-store-checkout />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreCheckoutMobileComponent {}
