import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { CustomerLeadsDesktopComponent } from './desktop/customer-leads.component';
import { CustomerLeadsMobileComponent } from './mobile/customer-leads.component';
import { CustomerLeadsFacade } from './state/customer-leads.facade';

@Component({
  selector: 'async-customer-leads-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CustomerLeadsDesktopComponent, CustomerLeadsMobileComponent],
  providers: [CustomerLeadsFacade],
  template: `
    @if (device.isMobileView()) {
      <async-customer-leads-mobile />
    } @else {
      <async-customer-leads-desktop />
    }
  `,
})
export class CustomerLeadsIndexComponent {
  protected readonly device = inject(DeviceService);
}
