import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ResourceDownloadContainerComponent } from '../resource-download-container.component';

/** Dedicated mobile entry point for ResourceDownloadContainerComponent. */
@Component({
  selector: 'async-resource-library-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ResourceDownloadContainerComponent],
  template: `<async-resource-download-container />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class ResourceDownloadContainerMobileComponent {}
