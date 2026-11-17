import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DownloadsComponent } from '../downloads.component';

/** Dedicated mobile entry point for DownloadsComponent. */
@Component({
  selector: 'async-downloads-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [DownloadsComponent],
  template: `<async-downloads />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class DownloadsMobileComponent {}
