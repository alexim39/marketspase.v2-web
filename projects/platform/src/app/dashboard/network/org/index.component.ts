import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { OrgChartDesktopComponent } from './desktop/org.component';
import { OrgChartMobileComponent } from './mobile/org.component';

@Component({
  selector: 'async-org-chart-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrgChartDesktopComponent, OrgChartMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-org-chart-mobile />
    } @else {
      <async-org-chart-desktop />
    }
  `,
})
export class OrgChartIndexComponent {
  protected readonly device = inject(DeviceService);
}
