import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreCartComponent } from '../cart.component';

/** Dedicated mobile entry point for StoreCartComponent. */
@Component({
  selector: 'async-store-cart-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreCartComponent],
  template: `<async-store-cart />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreCartMobileComponent {}
