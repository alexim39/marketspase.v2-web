import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreOrderTrackComponent } from '../order-track.component';

/** Dedicated mobile entry point for StoreOrderTrackComponent. */
@Component({
  selector: 'async-store-order-track-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreOrderTrackComponent],
  template: `<async-store-order-track />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreOrderTrackMobileComponent {}
