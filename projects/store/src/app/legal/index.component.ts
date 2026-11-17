import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LegalComponent } from './legal.component';
import { LegalMobileComponent } from './mobile/legal.component';

@Component({
  selector: 'async-legal-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [LegalComponent, LegalMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-legal-mobile />
    } @else {
      <async-legal />
    }
  `,
})
export class LegalIndexComponent {
  protected readonly device = inject(DeviceService);
}
