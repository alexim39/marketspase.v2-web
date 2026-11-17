import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { MessagesComponent } from './messages.component';
import { MessagesMobileComponent } from './mobile/messages.component';

@Component({
  selector: 'async-messages-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [MessagesComponent, MessagesMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-messages-mobile />
    } @else {
      <async-messages />
    }
  `,
})
export class MessagesIndexComponent {
  protected readonly device = inject(DeviceService);
}
