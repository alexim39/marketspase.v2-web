import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LegalComponent } from '../legal.component';

/** Dedicated mobile entry point for LegalComponent. */
@Component({
  selector: 'async-legal-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LegalComponent],
  template: `<async-legal />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class LegalMobileComponent {}
