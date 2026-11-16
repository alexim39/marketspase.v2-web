import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MemberViewDesktopComponent } from './desktop/member-view.component';
import { MemberViewMobileComponent } from './mobile/member-view.component';

@Component({
  selector: 'async-member-view-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MemberViewDesktopComponent, MemberViewMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-member-view-mobile />
    } @else {
      <async-member-view-desktop />
    }
  `,
})
export class MemberViewIndexComponent {
  protected readonly device = inject(DeviceService);
}
