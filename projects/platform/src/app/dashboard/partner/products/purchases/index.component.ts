import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { ProductService } from '../monthly-purchase.service';
import { PurchasesDesktopComponent } from './desktop/purchases.component';
import { PurchasesMobileComponent } from './mobile/purchases.component';
import { PurchasesFacade } from './state/purchases.facade';

@Component({
  selector: 'async-purchases-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PurchasesDesktopComponent, PurchasesMobileComponent],
  providers: [ProductService, PurchasesFacade],
  template: `
    @if (device.isMobileView()) {
      <async-purchases-mobile />
    } @else {
      <async-purchases-desktop />
    }
  `,
})
export class PurchasesIndexComponent {
  protected readonly device = inject(DeviceService);
}
