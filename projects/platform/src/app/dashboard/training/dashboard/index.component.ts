import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { AcademyDashboardComponent } from './academy-dashboard.component';
import { AcademyDashboardMobileComponent } from './mobile/academy-dashboard.component';

@Component({
  selector: 'async-training-dashboard-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AcademyDashboardComponent, AcademyDashboardMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-training-dashboard-mobile />
    } @else {
      <async-training-dashboard />
    }
  `,
})
export class AcademyDashboardIndexComponent {
  protected readonly device = inject(DeviceService);
}
