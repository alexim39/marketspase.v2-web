import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MyPartnersContactsContainerComponent } from './contacts-container.component';
import { MyPartnersContactsMobileComponent } from './mobile/contacts.component';

@Component({
  selector: 'async-my-partners-contacts-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MyPartnersContactsContainerComponent, MyPartnersContactsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-my-partners-contacts-mobile />
    } @else {
      <async-manage-contacts-container />
    }
  `,
})
export class MyPartnersContactsIndexComponent {
  protected readonly device = inject(DeviceService);
}
