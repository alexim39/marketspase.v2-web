import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LaunchPathComponent } from './launch-path.component';
import { LaunchPathMobileComponent } from './mobile/launch-path.component';

@Component({
  selector: 'async-launch-path-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LaunchPathComponent, LaunchPathMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-launch-path-mobile />
    } @else {
      <async-launch-path />
    }
  `,
})
export class LaunchPathIndexComponent {
  protected readonly device = inject(DeviceService);
}
