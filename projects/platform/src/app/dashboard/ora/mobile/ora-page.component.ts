import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OraPageComponent } from '../ora-page.component';

/** Dedicated mobile entry point for OraPageComponent. */
@Component({
  selector: 'async-ora-page-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [OraPageComponent],
  template: `<async-ora-page />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class OraPageMobileComponent {}
