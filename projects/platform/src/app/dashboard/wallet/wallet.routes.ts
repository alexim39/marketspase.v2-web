import { Routes } from '@angular/router';
import { WalletDashboardIndexComponent } from './dashboard/index.component';
import { WalletHistoryIndexComponent } from './history/index.component';
import { WalletDepositIndexComponent } from './deposit/index.component';
import { WalletDepositResultIndexComponent } from './deposit/result/index.component';

export const WalletRoutes: Routes = [
  {
    path: '',
    component: WalletDashboardIndexComponent,
    title: 'Wallet - Balance, flows and doors',
  },
  {
    path: 'history',
    component: WalletHistoryIndexComponent,
    title: 'Transaction History - Every naira',
  },
  {
    path: 'deposit',
    component: WalletDepositIndexComponent,
    title: 'Deposit Funds - Top up your wallet',
  },
  {
    path: 'deposit/result',
    component: WalletDepositResultIndexComponent,
    title: 'Deposit Result - Payment confirmation',
  },
];
