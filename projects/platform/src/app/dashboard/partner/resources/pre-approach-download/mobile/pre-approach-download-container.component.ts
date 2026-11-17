import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreapproachDownloadContainerComponent } from '../pre-approach-download-container.component';

/** Dedicated mobile entry point for PreapproachDownloadContainerComponent. */
@Component({
  selector: 'async-prospecting-guides-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PreapproachDownloadContainerComponent],
  template: `<async-manage-campaign-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class PreapproachDownloadContainerMobileComponent {}
