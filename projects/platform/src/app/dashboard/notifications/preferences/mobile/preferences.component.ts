import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NotificationPreferencesComponent } from '../preferences.component';

/** Dedicated mobile entry point for NotificationPreferencesComponent. */
@Component({
  selector: 'async-notification-preferences-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [NotificationPreferencesComponent],
  template: `<async-notification-preferences />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class NotificationPreferencesMobileComponent {}
