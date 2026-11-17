import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PersonalLeadPageComponent } from '../personal-lead-page.component';

/** Dedicated mobile entry point for PersonalLeadPageComponent. */
@Component({
  selector: 'async-personal-lead-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PersonalLeadPageComponent],
  template: `<async-personal-lead-page />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class PersonalLeadPageMobileComponent {}
