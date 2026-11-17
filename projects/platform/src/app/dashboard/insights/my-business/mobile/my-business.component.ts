import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyBusinessComponent } from '../my-business.component';

/** Dedicated mobile entry point for MyBusinessComponent. */
@Component({
  selector: 'async-my-business-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyBusinessComponent],
  template: `<async-my-business />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class MyBusinessMobileComponent {}
