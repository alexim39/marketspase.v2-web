import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProspectDetailDesktopComponent } from './desktop/detail.component';
import { ProspectDetailMobileComponent } from './mobile/detail.component';
import { ProspectDetailFacade } from './state/prospect-detail.facade';

@Component({
  selector: 'async-prospect-detail-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProspectDetailDesktopComponent, ProspectDetailMobileComponent],
  providers: [ProspectDetailFacade],
  template: `
    @if (device.isMobileView()) {
      <async-prospect-detail-mobile />
    } @else {
      <async-prospect-detail-desktop />
    }
  `,
})
export class ProspectDetailIndexComponent {
  protected readonly device = inject(DeviceService);
}
