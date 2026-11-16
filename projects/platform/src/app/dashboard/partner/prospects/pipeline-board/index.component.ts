import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { PipelineBoardDesktopComponent } from './desktop/board.component';
import { PipelineBoardMobileComponent } from './mobile/board.component';
import { PipelineBoardFacade } from './state/pipeline-board.facade';

@Component({
  selector: 'async-pipeline-board-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipelineBoardDesktopComponent, PipelineBoardMobileComponent],
  providers: [PipelineBoardFacade],
  template: `
    @if (device.isMobileView()) {
      <async-pipeline-board-mobile />
    } @else {
      <async-pipeline-board-desktop />
    }
  `,
})
export class PipelineBoardIndexComponent {
  protected readonly device = inject(DeviceService);
}
