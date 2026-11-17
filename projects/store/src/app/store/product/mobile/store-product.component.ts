import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreProductComponent } from '../store-product.component';

/** Dedicated mobile entry point for StoreProductComponent. */
@Component({
  selector: 'async-store-product-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreProductComponent],
  template: `<async-store-product />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreProductMobileComponent {}
