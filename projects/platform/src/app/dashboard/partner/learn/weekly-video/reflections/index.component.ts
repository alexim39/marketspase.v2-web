import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WeeklyVideoReflectionsComponent } from './reflections.component';
import { WeeklyVideoReflectionsMobileComponent } from './mobile/reflections.component';

@Component({
  selector: 'async-weekly-video-reflections-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [WeeklyVideoReflectionsComponent, WeeklyVideoReflectionsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-weekly-video-reflections-mobile />
    } @else {
      <async-weekly-video-reflections />
    }
  `,
})
export class WeeklyVideoReflectionsIndexComponent {
  protected readonly device = inject(DeviceService);
}
