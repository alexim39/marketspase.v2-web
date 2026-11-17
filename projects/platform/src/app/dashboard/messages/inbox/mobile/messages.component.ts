import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MessagesComponent } from '../messages.component';

/** Dedicated mobile entry point for MessagesComponent. */
@Component({
  selector: 'async-messages-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MessagesComponent],
  template: `<async-messages />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class MessagesMobileComponent {}
