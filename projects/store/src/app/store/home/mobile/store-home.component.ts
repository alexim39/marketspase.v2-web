import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreHomeComponent } from '../store-home.component';

/** Dedicated mobile entry point for StoreHomeComponent. */
@Component({
  selector: 'async-store-home-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreHomeComponent],
  template: `<async-store-home />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreHomeMobileComponent {}
