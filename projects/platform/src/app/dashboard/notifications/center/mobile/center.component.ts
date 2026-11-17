import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NotificationsCenterComponent } from '../center.component';

/** Dedicated mobile entry point for NotificationsCenterComponent. */
@Component({
  selector: 'async-notifications-center-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [NotificationsCenterComponent],
  template: `<async-notifications-center />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class NotificationsCenterMobileComponent {}
