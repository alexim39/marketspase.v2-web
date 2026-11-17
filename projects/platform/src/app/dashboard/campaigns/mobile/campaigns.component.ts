import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CampaignsComponent } from '../campaigns.component';

/** Dedicated mobile entry point for CampaignsComponent. */
@Component({
  selector: 'async-campaigns-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CampaignsComponent],
  template: `<async-growth-campaigns />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class CampaignsMobileComponent {}
