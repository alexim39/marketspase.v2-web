import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TrustCentreComponent } from '../trust-centre.component';

/** Dedicated mobile entry point for TrustCentreComponent. */
@Component({
  selector: 'async-trust-centre-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrustCentreComponent],
  template: `<async-trust-centre />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TrustCentreMobileComponent {}
