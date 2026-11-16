import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyPartnerContactsDetailContainerComponent } from './contacts-detail-container.component';
import { MyPartnerContactDetailMobileComponent } from './mobile/contacts-detail.component';

@Component({
  selector: 'async-my-partner-contact-detail-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnerContactsDetailContainerComponent, MyPartnerContactDetailMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-my-partner-contact-detail-mobile />
    } @else {
      <async-manage-contacts-detail-container />
    }
  `,
})
export class MyPartnerContactDetailIndexComponent {
  protected readonly device = inject(DeviceService);
}
