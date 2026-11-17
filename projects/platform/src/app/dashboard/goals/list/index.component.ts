import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { GoalsComponent } from './goals.component';
import { GoalsMobileComponent } from './mobile/goals.component';

@Component({
  selector: 'async-goals-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [GoalsComponent, GoalsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-goals-mobile />
    } @else {
      <async-goals />
    }
  `,
})
export class GoalsIndexComponent {
  protected readonly device = inject(DeviceService);
}
