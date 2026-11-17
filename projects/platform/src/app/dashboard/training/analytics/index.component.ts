import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TrainingAnalyticsComponent } from './training-analytics.component';
import { TrainingAnalyticsMobileComponent } from './mobile/training-analytics.component';

@Component({
  selector: 'async-training-analytics-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TrainingAnalyticsComponent, TrainingAnalyticsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-training-analytics-mobile />
    } @else {
      <async-training-analytics />
    }
  `,
})
export class TrainingAnalyticsIndexComponent {
  protected readonly device = inject(DeviceService);
}
