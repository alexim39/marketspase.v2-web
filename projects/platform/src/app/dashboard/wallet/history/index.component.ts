import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WalletHistoryDesktopComponent } from './desktop/wallet-history.component';
import { WalletHistoryMobileComponent } from './mobile/wallet-history.component';
import { WalletHistoryFacade } from './state/wallet-history.facade';

@Component({
  selector: 'async-wallet-history-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WalletHistoryDesktopComponent, WalletHistoryMobileComponent],
  providers: [WalletHistoryFacade],
  template: `
    @if (device.isMobileView()) {
      <async-wallet-history-mobile />
    } @else {
      <async-wallet-history-desktop />
    }
  `,
})
export class WalletHistoryIndexComponent {
  protected readonly device = inject(DeviceService);
}
