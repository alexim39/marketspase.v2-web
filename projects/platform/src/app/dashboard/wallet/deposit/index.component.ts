import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WalletDepositDesktopComponent } from './desktop/wallet-deposit.component';
import { WalletDepositMobileComponent } from './mobile/wallet-deposit.component';
import { WalletDepositFacade } from './state/wallet-deposit.facade';

@Component({
  selector: 'async-wallet-deposit-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WalletDepositDesktopComponent, WalletDepositMobileComponent],
  providers: [WalletDepositFacade],
  template: `
    @if (device.isMobileView()) {
      <async-wallet-deposit-mobile />
    } @else {
      <async-wallet-deposit-desktop />
    }
  `,
})
export class WalletDepositIndexComponent {
  protected readonly device = inject(DeviceService);
}
