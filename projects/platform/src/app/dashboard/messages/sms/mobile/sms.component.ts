import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SmsCenterComponent } from '../sms-center.component';

/** Dedicated mobile entry for the SMS Center. */
@Component({
  selector: 'async-sms-center-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SmsCenterComponent],
  template: `<async-sms-center />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class SmsCenterMobileComponent {}
