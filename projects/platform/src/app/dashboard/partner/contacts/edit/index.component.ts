import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { EditContactsDesktopComponent } from './desktop/edit-contacts.component';
import { EditContactsMobileComponent } from './mobile/edit-contacts.component';
import { EditContactsFacade } from './state/edit-contacts.facade';

@Component({
  selector: 'async-edit-contacts-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditContactsDesktopComponent, EditContactsMobileComponent],
  providers: [EditContactsFacade],
  template: `
    @if (device.isMobileView()) {
      <async-edit-contacts-mobile />
    } @else {
      <async-edit-contacts-desktop />
    }
  `,
})
export class EditContactsIndexComponent {
  protected readonly device = inject(DeviceService);
}
