import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CompensationDesktopComponent } from './desktop/compensation.component';
import { CompensationMobileComponent } from './mobile/compensation.component';
import { CompensationFacade } from './state/compensation.facade';

@Component({
  selector: 'async-compensation-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CompensationDesktopComponent, CompensationMobileComponent],
  providers: [CompensationFacade],
  template: `
    @if (device.isMobileView()) {
      <async-compensation-mobile />
    } @else {
      <async-compensation-desktop />
    }
  `,
})
export class CompensationIndexComponent {
  protected readonly device = inject(DeviceService);
}
