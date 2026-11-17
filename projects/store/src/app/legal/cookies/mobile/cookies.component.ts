import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CookiesComponent } from '../cookies.component';

/** Dedicated mobile entry point for CookiesComponent. */
@Component({
  selector: 'async-cookies-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CookiesComponent],
  template: `<async-cookies />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class CookiesMobileComponent {}
