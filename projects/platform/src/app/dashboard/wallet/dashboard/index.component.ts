import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WalletDashboardDesktopComponent } from './desktop/wallet-dashboard.component';
import { WalletDashboardMobileComponent } from './mobile/wallet-dashboard.component';
import { WalletDashboardFacade } from './state/wallet-dashboard.facade';

/**
 * Device-aware wallet dashboard entry point.
 *
 * The single facade lives on this wrapper and survives a view swap, so the
 * active page never reloads its wallet, commission or campaign data on resize.
 */
@Component({
  selector: 'async-wallet-dashboard-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WalletDashboardDesktopComponent, WalletDashboardMobileComponent],
  providers: [WalletDashboardFacade],
  template: `
    @if (device.isMobileView()) {
      <async-wallet-dashboard-mobile />
    } @else {
      <async-wallet-dashboard-desktop />
    }
  `,
})
export class WalletDashboardIndexComponent {
  protected readonly device = inject(DeviceService);
}
