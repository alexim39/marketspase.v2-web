import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StorefrontComponent } from '../storefront.component';

/** Dedicated mobile entry point for StorefrontComponent. */
@Component({
  selector: 'async-storefront-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StorefrontComponent],
  template: `<async-storefront />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StorefrontMobileComponent {}
