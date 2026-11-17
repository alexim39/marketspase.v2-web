import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TermsComponent } from '../terms.component';

/** Dedicated mobile entry point for TermsComponent. */
@Component({
  selector: 'async-terms-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TermsComponent],
  template: `<async-terms />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class TermsMobileComponent {}
