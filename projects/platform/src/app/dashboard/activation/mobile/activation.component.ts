import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivationComponent } from '../activation.component';

/** Dedicated mobile entry point for ActivationComponent. */
@Component({
  selector: 'async-activation-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [ActivationComponent],
  template: `<async-activation />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class ActivationMobileComponent {}
