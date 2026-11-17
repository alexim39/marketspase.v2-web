import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CampaignsComponent } from './campaigns.component';
import { CampaignsMobileComponent } from './mobile/campaigns.component';

@Component({
  selector: 'async-campaigns-index',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CampaignsComponent, CampaignsMobileComponent],
  template: `
    @if (device.isMobileView()) {
      <async-campaigns-mobile />
    } @else {
      <async-growth-campaigns />
    }
  `,
})
export class CampaignsIndexComponent {
  protected readonly device = inject(DeviceService);
}
