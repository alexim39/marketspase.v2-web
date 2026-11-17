import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PersonalLeadPageComponent } from './personal-lead-page.component';
import { PersonalLeadPageMobileComponent } from './mobile/personal-lead-page.component';

@Component({
  selector: 'async-personal-lead-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PersonalLeadPageComponent, PersonalLeadPageMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-personal-lead-mobile />
    } @else {
      <async-personal-lead-page />
    }
  `,
})
export class PersonalLeadPageIndexComponent {
  protected readonly device = inject(DeviceService);
}
