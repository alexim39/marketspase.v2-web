import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StoreDirectoryComponent } from '../store-directory.component';

/** Dedicated mobile entry point for StoreDirectoryComponent. */
@Component({
  selector: 'async-store-directory-mobile',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [StoreDirectoryComponent],
  template: `<async-store-directory />`,
  styles: [`:host { display: block; min-width: 0; overflow-x: clip; }`],
})
export class StoreDirectoryMobileComponent {}
