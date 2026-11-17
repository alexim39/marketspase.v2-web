import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { InsightsOverviewComponent } from './insights.component';
import { InsightsOverviewMobileComponent } from './mobile/insights.component';

@Component({
  selector: 'async-insights-overview-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [InsightsOverviewComponent, InsightsOverviewMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-insights-overview-mobile />
    } @else {
      <async-insights-overview />
    }
  `,
})
export class InsightsOverviewIndexComponent {
  protected readonly device = inject(DeviceService);
}
