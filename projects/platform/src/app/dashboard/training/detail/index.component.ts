import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TrainingDetailComponent } from './training-detail.component';
import { TrainingDetailMobileComponent } from './mobile/training-detail.component';

@Component({
  selector: 'async-training-detail-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingDetailComponent, TrainingDetailMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-training-detail-mobile />
    } @else {
      <async-training-detail />
    }
  `,
})
export class TrainingDetailIndexComponent {
  protected readonly device = inject(DeviceService);
}
