import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProgressComponent } from './progress.component';
import { ProgressMobileComponent } from './mobile/progress.component';

@Component({
  selector: 'async-progress-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ProgressComponent, ProgressMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-progress-mobile />
    } @else {
      <async-progress />
    }
  `,
})
export class ProgressIndexComponent {
  protected readonly device = inject(DeviceService);
}
