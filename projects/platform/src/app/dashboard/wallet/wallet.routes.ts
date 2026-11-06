import { Routes } from '@angular/router';
import { WalletDashboardComponent } from './dashboard/wallet-dashboard.component';
import { WalletHistoryComponent } from './history/wallet-history.component';
import { WalletDepositComponent } from './deposit/wallet-deposit.component';
import { WalletDepositResultComponent } from './deposit/wallet-deposit-result.component';

export const WalletRoutes: Routes = [
  {
    path: '',
    component: WalletDashboardComponent,
    title: 'Wallet - Balance, flows and doors',
  },
  {
    path: 'history',
    component: WalletHistoryComponent,
    title: 'Transaction History - Every naira',
  },
  {
    path: 'deposit',
    component: WalletDepositComponent,
    title: 'Deposit Funds - Top up your wallet',
  },
  {
    path: 'deposit/result',
    component: WalletDepositResultComponent,
    title: 'Deposit Result - Payment confirmation',
  },
];
