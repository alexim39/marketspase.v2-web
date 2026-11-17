import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CommunityHubComponent } from './community-hub.component';
import { CommunityHubMobileComponent } from './mobile/community-hub.component';

@Component({
  selector: 'async-community-hub-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityHubComponent, CommunityHubMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-community-hub-mobile />
    } @else {
      <async-community-hub />
    }
  `,
})
export class CommunityHubIndexComponent {
  protected readonly device = inject(DeviceService);
}
