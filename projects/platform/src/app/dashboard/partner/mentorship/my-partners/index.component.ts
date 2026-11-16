import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyPartnersDesktopComponent } from './desktop/my-partners.component';
import { MyPartnersMobileComponent } from './mobile/my-partners.component';
import { MyPartnersFacade } from './state/my-partners.facade';
import { MyPartnersService } from './my-partners.service';

@Component({
  selector: 'async-my-partners-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MyPartnersDesktopComponent, MyPartnersMobileComponent],
  providers: [MyPartnersFacade, MyPartnersService],
  template: `
    @if (device.isMobileView()) {
      <async-my-partners-mobile />
    } @else {
      <async-my-partners-desktop />
    }
  `,
})
export class MyPartnersIndexComponent {
  protected readonly device = inject(DeviceService);
}
