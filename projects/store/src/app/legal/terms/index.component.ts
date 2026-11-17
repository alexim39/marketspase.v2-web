import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TermsComponent } from './terms.component';
import { TermsMobileComponent } from './mobile/terms.component';

@Component({
  selector: 'async-terms-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TermsComponent, TermsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-terms-mobile />
    } @else {
      <async-terms />
    }
  `,
})
export class TermsIndexComponent {
  protected readonly device = inject(DeviceService);
}
