import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { WalletDepositResultDesktopComponent } from './desktop/wallet-deposit-result.component';
import { WalletDepositResultMobileComponent } from './mobile/wallet-deposit-result.component';
import { WalletDepositResultFacade } from './state/wallet-deposit-result.facade';

@Component({
  selector: 'async-wallet-deposit-result-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WalletDepositResultDesktopComponent, WalletDepositResultMobileComponent],
  providers: [WalletDepositResultFacade],
  template: `
    @if (device.isMobileView()) {
      <async-wallet-deposit-result-mobile />
    } @else {
      <async-wallet-deposit-result-desktop />
    }
  `,
})
export class WalletDepositResultIndexComponent {
  protected readonly device = inject(DeviceService);
}
