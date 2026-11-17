import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SubmitTicketContainerComponent } from '../submit-ticket-container.component';

/** Dedicated mobile entry point for SubmitTicketContainerComponent. */
@Component({
  selector: 'async-submit-ticket-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SubmitTicketContainerComponent],
  template: `<async-submit-ticket-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class SubmitTicketContainerMobileComponent {}
