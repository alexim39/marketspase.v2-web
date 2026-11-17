import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PrivacyComponent } from '../privacy.component';

/** Dedicated mobile entry point for PrivacyComponent. */
@Component({
  selector: 'async-privacy-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PrivacyComponent],
  template: `<async-privacy />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class PrivacyMobileComponent {}
