import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VerificationComponent } from '../verification.component';

/** Dedicated mobile entry point for VerificationComponent. */
@Component({
  selector: 'async-verification-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [VerificationComponent],
  template: `<async-verification />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class VerificationMobileComponent {}
