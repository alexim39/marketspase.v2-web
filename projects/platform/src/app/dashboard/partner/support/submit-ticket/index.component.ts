import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { SubmitTicketContainerComponent } from './submit-ticket-container.component';
import { SubmitTicketContainerMobileComponent } from './mobile/submit-ticket-container.component';

@Component({
  selector: 'async-submit-ticket-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SubmitTicketContainerComponent, SubmitTicketContainerMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-submit-ticket-mobile />
    } @else {
      <async-submit-ticket-container />
    }
  `,
})
export class SubmitTicketContainerIndexComponent {
  protected readonly device = inject(DeviceService);
}
