import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProspectCreateDesktopComponent } from './desktop/prospect-create.component';
import { ProspectCreateMobileComponent } from './mobile/prospect-create.component';
import { ProspectCreateFacade } from './state/prospect-create.facade';

@Component({
  selector: 'async-prospect-create-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProspectCreateDesktopComponent, ProspectCreateMobileComponent],
  providers: [ProspectCreateFacade],
  template: `
    @if (device.isMobileView()) {
      <async-prospect-create-mobile />
    } @else {
      <async-prospect-create-desktop />
    }
  `,
})
export class ProspectCreateIndexComponent {
  protected readonly device = inject(DeviceService);
}
