import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { TutorialsComponent } from './tutorials.component';
import { TutorialsMobileComponent } from './mobile/tutorials.component';

@Component({
  selector: 'async-training-tutorials-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [TutorialsComponent, TutorialsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-training-tutorials-mobile />
    } @else {
      <async-tutorials />
    }
  `,
})
export class TutorialsIndexComponent {
  protected readonly device = inject(DeviceService);
}
