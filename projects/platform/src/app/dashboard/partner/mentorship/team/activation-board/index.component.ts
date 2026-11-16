import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ActivationBoardDesktopComponent } from './desktop/activation-board.component';
import { ActivationBoardMobileComponent } from './mobile/activation-board.component';
import { ActivationBoardFacade } from './state/activation-board.facade';

@Component({
  selector: 'async-activation-board-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivationBoardDesktopComponent, ActivationBoardMobileComponent],
  providers: [ActivationBoardFacade],
  template: `
    @if (device.isMobileView()) {
      <async-activation-board-mobile />
    } @else {
      <async-activation-board-desktop />
    }
  `,
})
export class ActivationBoardIndexComponent {
  protected readonly device = inject(DeviceService);
}
