import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CommunityFeedComponent } from './community-feed.component';
import { CommunityFeedMobileComponent } from './mobile/community-feed.component';

@Component({
  selector: 'async-community-feed-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityFeedComponent, CommunityFeedMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-community-feed-mobile />
    } @else {
      <async-community-feed />
    }
  `,
})
export class CommunityFeedIndexComponent {
  protected readonly device = inject(DeviceService);
}
