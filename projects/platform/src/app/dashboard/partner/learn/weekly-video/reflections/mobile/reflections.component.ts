import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WeeklyVideoReflectionsComponent } from '../reflections.component';

/** Dedicated mobile entry point for WeeklyVideoReflectionsComponent. */
@Component({
  selector: 'async-weekly-video-reflections-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [WeeklyVideoReflectionsComponent],
  template: `<async-weekly-video-reflections />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class WeeklyVideoReflectionsMobileComponent {}
