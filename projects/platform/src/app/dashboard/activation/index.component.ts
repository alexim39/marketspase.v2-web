import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ActivationComponent } from './activation.component';
import { ActivationMobileComponent } from './mobile/activation.component';

@Component({
  selector: 'async-activation-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ActivationComponent, ActivationMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-activation-mobile />
    } @else {
      <async-activation />
    }
  `,
})
export class ActivationIndexComponent {
  protected readonly device = inject(DeviceService);
}
