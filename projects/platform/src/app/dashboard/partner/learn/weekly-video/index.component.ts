import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WeeklyVideoComponent } from './weekly-video.component';
import { WeeklyVideoMobileComponent } from './mobile/weekly-video.component';

@Component({
  selector: 'async-weekly-video-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [WeeklyVideoComponent, WeeklyVideoMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-weekly-video-mobile />
    } @else {
      <async-weekly-video />
    }
  `,
})
export class WeeklyVideoIndexComponent {
  protected readonly device = inject(DeviceService);
}
