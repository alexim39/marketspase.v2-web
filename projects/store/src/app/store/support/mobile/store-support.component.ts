import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreSupportComponent } from '../store-support.component';

/** Dedicated mobile entry point for StoreSupportComponent. */
@Component({
  selector: 'async-store-support-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreSupportComponent],
  template: `<async-store-support />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreSupportMobileComponent {}
