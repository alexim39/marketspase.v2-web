import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TrainingListComponent } from './training-list.component';
import { TrainingListMobileComponent } from './mobile/training-list.component';

@Component({
  selector: 'async-training-list-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingListComponent, TrainingListMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-training-list-mobile />
    } @else {
      <async-training-list />
    }
  `,
})
export class TrainingListIndexComponent {
  protected readonly device = inject(DeviceService);
}
