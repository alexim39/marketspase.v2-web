import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CommunityEventsComponent } from './events.component';
import { CommunityEventsMobileComponent } from './mobile/events.component';

@Component({
  selector: 'async-community-events-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommunityEventsComponent, CommunityEventsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-community-events-mobile />
    } @else {
      <async-community-events />
    }
  `,
})
export class CommunityEventsIndexComponent {
  protected readonly device = inject(DeviceService);
}
