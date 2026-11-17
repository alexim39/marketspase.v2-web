import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WeeklyVideoComponent } from '../weekly-video.component';

/** Dedicated mobile entry point for WeeklyVideoComponent. */
@Component({
  selector: 'async-weekly-video-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [WeeklyVideoComponent],
  template: `<async-weekly-video />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class WeeklyVideoMobileComponent {}
