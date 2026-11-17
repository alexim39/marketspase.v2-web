import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LearnHubComponent } from './learn-hub.component';
import { LearnHubMobileComponent } from './mobile/learn-hub.component';

@Component({
  selector: 'async-learn-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LearnHubComponent, LearnHubMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-learn-mobile />
    } @else {
      <async-learn-hub />
    }
  `,
})
export class LearnHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
